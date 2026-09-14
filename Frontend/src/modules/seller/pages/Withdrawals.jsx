import React, { useState, useMemo, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Modal from '@shared/components/ui/Modal';
import {
    Wallet,
    ArrowUpRight,
    Clock,
    CheckCircle2,
    XCircle,
    History,
    Download,
    Building2,
    Info,
    ArrowRight,
    Search,
    QrCode,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlurFade } from "@/components/ui/blur-fade";
import { sellerApi } from "../services/sellerApi";
import { toast } from "sonner";
import { useSellerEarnings } from "../context/SellerEarningsContext";
import Pagination from "@shared/components/ui/Pagination";
import { Link } from "react-router-dom";

const Withdrawals = () => {
    const { earningsData: data, earningsLoading: loading, refreshEarnings } = useSellerEarnings();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [amount, setAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [withdrawalSettings, setWithdrawalSettings] = useState({
        minWithdrawalAmount: 0,
        maxWithdrawalAmount: 0,
        bankInfo: {},
        hasUpi: false,
        hasBank: false,
    });

    useEffect(() => {
        let mounted = true;
        const loadSettings = async () => {
            try {
                const res = await sellerApi.getWithdrawalSettings();
                if (!mounted) return;
                if (res.data?.success) {
                    setWithdrawalSettings(res.data.result || {});
                }
            } catch (error) {
                console.error("Failed to load withdrawal settings", error);
            }
        };
        loadSettings();
        return () => {
            mounted = false;
        };
    }, []);

    const ledger = Array.isArray(data?.ledger) ? data.ledger : [];
    const withdrawalHistory = ledger.filter((t) => (t.type || '').toString() === 'Withdrawal');
    const bankInfo = withdrawalSettings?.bankInfo || {};
    const minWd = Math.max(0, Number(withdrawalSettings?.minWithdrawalAmount || 0));
    const maxWd = Math.max(0, Number(withdrawalSettings?.maxWithdrawalAmount || 0));

    const filteredHistory = useMemo(() => {
        const term = searchTerm.toLowerCase();
        const result = withdrawalHistory.filter((item) => {
            const id = (item.id ?? item.ref ?? '').toString().toLowerCase();
            const status = (item.status ?? '').toString().toLowerCase();
            const method = (item.method ?? item.customer ?? '').toString().toLowerCase();
            const amountValue = Math.abs(Number(item.amount ?? 0)).toString();
            return (
                !term ||
                id.includes(term) ||
                status.includes(term) ||
                method.includes(term) ||
                amountValue.includes(term)
            );
        });
        const totalPages = Math.max(1, Math.ceil(result.length / pageSize));
        if (page > totalPages) {
            setPage(1);
        }
        return result;
    }, [withdrawalHistory, searchTerm, page, pageSize]);

    const paginatedHistory = useMemo(() => {
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        return filteredHistory.slice(start, end);
    }, [filteredHistory, page, pageSize]);

    const handleDownloadReceipt = (item) => {
        const id = item.id || item.ref || item.reference || 'withdrawal';
        const lines = [];
        lines.push('Withdrawal Receipt');
        lines.push(`ID,${id}`);
        lines.push(`Status,${item.status ?? ''}`);
        lines.push(`Date,${item.date ?? ''}`);
        lines.push(`Time,${item.time ?? ''}`);
        lines.push(`Amount,₹${Math.abs(item.amount ?? 0).toLocaleString()}`);
        lines.push(`Method,${item.customer ?? 'Bank Transfer'}`);
        if (item.reason) {
            lines.push(`Reason,${item.reason}`);
        }
        const csvContent = lines.join('\n');
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `withdrawal-receipt-${id}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Receipt downloaded');
    };

    const handleSubmitRequest = async (e) => {
        e.preventDefault();
        const settled = Number(data?.balances?.settledBalance ?? 0);
        const available = Math.max(0, settled);
        const value = Number.parseFloat(amount);

        if (!withdrawalSettings.hasUpi && !withdrawalSettings.hasBank) {
            toast.error("Add UPI ID or bank details in Profile before requesting withdrawal.");
            return;
        }

        if (!Number.isFinite(value) || value <= 0) {
            toast.error("Please enter a valid amount.");
            return;
        }
        if (value > available) {
            toast.error(`Amount exceeds available balance (₹${available.toLocaleString()}).`);
            return;
        }
        if (minWd > 0 && value < minWd) {
            toast.error(`Minimum withdrawal amount is ₹${minWd.toLocaleString()}.`);
            return;
        }
        if (maxWd > 0 && value > maxWd) {
            toast.error(`Maximum withdrawal amount is ₹${maxWd.toLocaleString()}.`);
            return;
        }

        try {
            setIsSubmitting(true);
            const response = await sellerApi.requestWithdrawal({
                amount: value,
                paymentMethod: withdrawalSettings.hasUpi ? "upi" : "bank_transfer",
            });
            if (response.data.success) {
                toast.success('Withdrawal request submitted successfully!');
                setIsModalOpen(false);
                setAmount('');
                refreshEarnings();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to submit request");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center h-screen font-black text-slate-600">LOADING WITHDRAWALS...</div>;
    }

    const balances = {
        available: Math.max(0, Number(data.balances?.settledBalance ?? 0)),
        pending: Math.abs(Number(data.balances?.pendingPayouts ?? 0)),
        lastWithdrawal: Math.abs(withdrawalHistory.find((item) => item.status === 'Settled')?.amount ?? 0),
    };

    // Used conditionally directly in the UI now

    return (
        <div className="space-y-4 px-3.5 md:px-4 max-w-5xl md:max-w-none mx-auto w-full pb-20">
            {/* Header Bar */}
            <BlurFade delay={0.1}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 mb-1">
                    <div>
                        <h1 className="text-lg sm:text-xl font-semibold text-[#1c1c1e] tracking-tight flex items-center gap-2">
                            Money Requests
                            <span className="p-1 bg-red-100 rounded-md">
                                <Wallet className="h-4 w-4 text-red-600" />
                            </span>
                        </h1>
                        <p className="text-xs font-normal text-slate-500 mt-0.5">
                            Request payouts and track your withdrawal history.
                        </p>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer group"
                    >
                        <ArrowUpRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        <span>New Request</span>
                    </button>
                </div>
            </BlurFade>

            {/* 2-by-2 Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5">
                {[
                    { label: 'Available Balance', value: `₹${balances.available.toLocaleString()}`, icon: Wallet, bg: 'bg-[#F0FDF4]', border: 'border-emerald-200/80', color: 'text-emerald-950', iconBg: 'bg-emerald-100 text-emerald-700', sub: 'Ready to withdraw' },
                    { label: 'Pending Requests', value: `₹${balances.pending.toLocaleString()}`, icon: Clock, bg: 'bg-[#FFFBEB]', border: 'border-amber-200/80', color: 'text-amber-950', iconBg: 'bg-amber-100 text-amber-700', sub: 'Awaiting approval' },
                    { label: 'Last Withdrawal', value: `₹${balances.lastWithdrawal.toLocaleString()}`, icon: CheckCircle2, bg: 'bg-[#F0F9FF]', border: 'border-sky-200/80', color: 'text-sky-950', iconBg: 'bg-sky-100 text-sky-700', sub: 'Sent to bank' },
                    { label: 'History Records', value: `${withdrawalHistory.length} txns`, icon: History, bg: 'bg-[#F5F3FF]', border: 'border-purple-200/80', color: 'text-purple-950', iconBg: 'bg-purple-100 text-purple-700', sub: 'Total requests' },
                ].map((stat, i) => (
                    <BlurFade key={i} delay={0.15 + i * 0.05}>
                        <div className={cn(
                            "p-3 sm:p-3.5 rounded-xl border shadow-2xs flex items-center justify-between gap-2.5 transition-all",
                            stat.bg,
                            stat.border
                        )}>
                            <div className="min-w-0">
                                <p className="text-[10px] sm:text-xs font-medium text-slate-600 truncate uppercase tracking-wider">{stat.label}</p>
                                <h4 className={cn("text-base sm:text-lg font-semibold tracking-tight mt-0.5 truncate", stat.color)}>{stat.value}</h4>
                                <p className="text-[10px] text-slate-500 font-normal mt-0.5 truncate">{stat.sub}</p>
                            </div>
                            <div className={cn("h-8 w-8 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center shrink-0 shadow-2xs", stat.iconBg)}>
                                <stat.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                            </div>
                        </div>
                    </BlurFade>
                ))}
            </div>

            <BlurFade delay={0.35}>
                <Card className="p-5 sm:p-6 border-none shadow-sm ring-1 ring-slate-100 bg-white rounded-3xl">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div>
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2">Allowed Withdrawal Range</h2>
                            <p className="text-sm font-bold text-slate-700">
                                Min ₹{minWd.toLocaleString()}
                                {" — "}
                                {maxWd > 0 ? `Max ₹${maxWd.toLocaleString()}` : "No maximum limit"}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">You can only request an amount inside this range (and within available balance).</p>
                        </div>
                        <div className="flex items-start gap-4 bg-slate-50 rounded-2xl p-4 ring-1 ring-slate-100 min-w-[260px]">
                            {bankInfo.upiQrImage ? (
                                <img src={bankInfo.upiQrImage} alt="UPI QR" className="h-20 w-20 object-contain rounded-xl bg-white border border-slate-100" />
                            ) : (
                                <div className="h-20 w-20 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-300">
                                    <QrCode className="h-8 w-8" />
                                </div>
                            )}
                            <div className="min-w-0">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payout Details</p>
                                {bankInfo.upiId && <p className="text-sm font-black text-slate-900 mt-1 break-all">UPI: {bankInfo.upiId}</p>}
                                {bankInfo.bankName && (
                                    <div className="mt-1">
                                        <p className="text-sm font-black text-slate-900">{bankInfo.bankName} • {bankInfo.accountNumber || (bankInfo.accountNumberLast4 ? `**** ${bankInfo.accountNumberLast4}` : "----")}</p>
                                        <p className="text-xs text-slate-500">IFSC: {bankInfo.ifscCode}</p>
                                        {bankInfo.accountHolderName && <p className="text-xs text-slate-500">{bankInfo.accountHolderName}</p>}
                                    </div>
                                )}
                                {(!bankInfo.upiId && !bankInfo.bankName) && <p className="text-sm font-black text-slate-900 mt-1">Add UPI / bank in Profile</p>}
                                <Link to="/seller/profile" className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-red-500 mt-2">
                                    Update in Profile <ArrowRight className="h-3 w-3" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </Card>
            </BlurFade>

            {/* History Table */}
            <BlurFade delay={0.3}>
                <div className="border border-slate-200/80 shadow-xs overflow-hidden rounded-xl bg-white space-y-3 p-3.5 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <h2 className="text-xs sm:text-sm font-semibold text-[#1c1c1e] flex items-center gap-1.5">
                            <History className="h-4 w-4 text-red-600" />
                            <span>Withdrawal History</span>
                        </h2>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search ID or status..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50/70 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs font-normal text-slate-900 outline-none focus:bg-white focus:border-red-500 transition-all placeholder:text-slate-400"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[600px] text-xs">
                            <thead>
                                <tr className="bg-slate-50/70 border-b border-slate-100">
                                    <th className="px-3.5 py-2 font-semibold text-slate-600 uppercase tracking-wider text-[10px]">Request Details</th>
                                    <th className="px-3.5 py-2 font-semibold text-slate-600 uppercase tracking-wider text-[10px]">Amount</th>
                                    <th className="px-3.5 py-2 font-semibold text-slate-600 uppercase tracking-wider text-[10px] text-center">Status</th>
                                    <th className="px-3.5 py-2 font-semibold text-slate-600 uppercase tracking-wider text-[10px] text-right">Method & Receipt</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredHistory.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-slate-500 text-xs font-normal">
                                            {withdrawalHistory.length === 0 ? "No withdrawal requests created yet." : "No matches found for search query."}
                                        </td>
                                    </tr>
                                ) : paginatedHistory.map((item, idx) => (
                                    <tr key={item.id || item.ref || item.reference || `wd-${idx}`} className="group hover:bg-slate-50/70 transition-colors">
                                        <td className="px-3.5 py-2.5">
                                            <p className="text-xs font-semibold text-[#1c1c1e]">{item.id}</p>
                                            <p className="text-[10px] font-normal text-slate-500 mt-0.5">{item.date} • {item.time}</p>
                                        </td>
                                        <td className="px-3.5 py-2.5">
                                            <p className="text-xs font-semibold text-slate-900 tabular-nums">₹{Math.abs(item.amount).toLocaleString()}</p>
                                        </td>
                                        <td className="px-3.5 py-2.5 text-center">
                                            <span
                                                className={`inline-flex items-center text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                                                    item.status === 'Settled'
                                                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                                        : (item.status === 'Pending' || item.status === 'Processing')
                                                            ? 'bg-amber-100 text-amber-700 border-amber-200'
                                                            : 'bg-rose-100 text-rose-700 border-rose-200'
                                                }`}
                                            >
                                                {item.status === 'Settled' ? <CheckCircle2 className="h-3 w-3 mr-1" /> : (item.status === 'Pending' || item.status === 'Processing') ? <Clock className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                                                {item.status}
                                            </span>
                                            {item.reason && <p className="text-[10px] text-rose-600 font-normal mt-0.5 italic">{item.reason}</p>}
                                        </td>
                                        <td className="px-3.5 py-2.5 text-right">
                                            <p className="text-xs font-medium text-slate-700 truncate">{item.customer || "Bank Transfer"}</p>
                                            <button
                                                type="button"
                                                onClick={() => handleDownloadReceipt(item)}
                                                className="text-[10px] font-semibold text-red-600 hover:text-red-700 mt-0.5 inline-flex items-center gap-1 justify-end ml-auto cursor-pointer"
                                            >
                                                Receipt <Download className="h-3 w-3" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {filteredHistory.length > 0 && (
                        <div className="pt-2 border-t border-slate-100">
                            <Pagination
                                page={page}
                                totalPages={Math.max(1, Math.ceil(filteredHistory.length / pageSize))}
                                total={filteredHistory.length}
                                pageSize={pageSize}
                                onPageChange={(newPage) => setPage(newPage)}
                                onPageSizeChange={(newSize) => {
                                    setPageSize(newSize);
                                    setPage(1);
                                }}
                                loading={loading}
                            />
                        </div>
                    )}
                </div>
            </BlurFade>

            {/* Request Withdrawal Modal - Compact & Clean Rounded-lg Corners */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => !isSubmitting && setIsModalOpen(false)}
                title="Request Withdrawal"
            >
                <form onSubmit={handleSubmitRequest} className="space-y-3 py-1">
                    {/* Available to Withdraw Box */}
                    <div className="bg-[#F0FDF4] p-3 rounded-lg border border-emerald-200/80 flex items-center justify-between shadow-2xs">
                        <div>
                            <p className="text-[11px] font-medium text-emerald-800">Available to Withdraw</p>
                            <h4 className="text-xl font-semibold text-emerald-950 mt-0.5">₹{balances.available.toLocaleString()}</h4>
                            <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-widest">
                                Allowed: ₹{minWd.toLocaleString()} — {maxWd > 0 ? `₹${maxWd.toLocaleString()}` : "No max"}
                            </p>
                        </div>
                        <div className="h-8 w-8 bg-emerald-100/80 text-emerald-700 rounded-lg flex items-center justify-center shrink-0">
                            <Info className="h-4 w-4" />
                        </div>
                    </div>

                    {/* Form Inputs */}
                    <div className="space-y-2.5">
                        <div>
                            <label className="text-xs font-medium text-slate-700 mb-1 block">Enter Amount</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₹</span>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0.00"
                                    min={minWd || 0}
                                    max={maxWd > 0 ? Math.min(maxWd, balances.available) : balances.available}
                                    className="w-full pl-7 pr-3 py-1.5 bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-red-500 rounded-lg text-sm font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-400"
                                />
                            </div>
                        </div>

                        <div className="p-2.5 bg-rose-50/50 rounded-lg border border-rose-100 space-y-1">
                            <p className="text-[10px] font-medium text-rose-600 uppercase tracking-wider">Transfer Destination</p>
                            <div className="flex items-center gap-2.5">
                                {bankInfo.upiQrImage ? (
                                    <img src={bankInfo.upiQrImage} alt="UPI QR" className="h-7 w-7 rounded-md object-contain bg-white border border-rose-200/60" />
                                ) : (
                                    <div className="h-7 w-7 bg-white rounded-md border border-rose-200/60 flex items-center justify-center shrink-0">
                                        <Building2 className="h-3.5 w-3.5 text-rose-600" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    {bankInfo.upiId && <p className="text-xs font-semibold text-[#1c1c1e] truncate">UPI: {bankInfo.upiId}</p>}
                                    {bankInfo.bankName && <p className="text-xs font-semibold text-[#1c1c1e] truncate">{bankInfo.bankName} • {bankInfo.accountNumber || (bankInfo.accountNumberLast4 ? `**** ${bankInfo.accountNumberLast4}` : "----")}</p>}
                                    {(!bankInfo.upiId && !bankInfo.bankName) && <p className="text-xs font-semibold text-[#1c1c1e] truncate">Add UPI / bank in Profile</p>}
                                    <p className="text-[10px] font-normal text-slate-500">
                                        {bankInfo.upiId ? "UPI Transfer" : bankInfo.bankName ? "Bank Transfer" : "Incomplete payout details"}
                                    </p>
                                </div>
                                <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-1.5 pt-2">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                            {isSubmitting ? <div className="h-3.5 w-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : 'Submit Request'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="w-full py-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                        >
                            Cancel / Nevermind
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Withdrawals;
