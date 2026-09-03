import React, { useState, useMemo, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Button from '@shared/components/ui/Button';
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
    AlertCircle,
    Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { BlurFade } from "@/components/ui/blur-fade";
import { sellerApi } from "../services/sellerApi";
import { toast } from "sonner";
import { useSellerEarnings } from "../context/SellerEarningsContext";
import Pagination from "@shared/components/ui/Pagination";

const Withdrawals = () => {
    const { earningsData: data, earningsLoading: loading, refreshEarnings } = useSellerEarnings();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [amount, setAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [paymentMethod, setPaymentMethod] = useState('upi');
    const [upiId, setUpiId] = useState('');
    const [bankName, setBankName] = useState('');
    const [accountHolderName, setAccountHolderName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [ifscCode, setIfscCode] = useState('');
    const [qrPreview, setQrPreview] = useState('');
    const [qrBase64, setQrBase64] = useState('');
    const [minWithdrawal, setMinWithdrawal] = useState(null);
    const [maxWithdrawal, setMaxWithdrawal] = useState(null);
    const [limitsLoading, setLimitsLoading] = useState(false);
    const [sellerProfile, setSellerProfile] = useState(null);

    const applyProfilePaymentInfo = (p) => {
        const b = p?.bankInfo || {};
        if (b.upiId) setUpiId(b.upiId);
        if (b.upiQrImage) {
            setQrPreview(b.upiQrImage);
            setQrBase64(b.upiQrImage);
        }
        if (b.bankName) setBankName(b.bankName);
        if (b.accountHolderName || p?.name) setAccountHolderName(b.accountHolderName || p?.name || '');
        if (b.accountNumber) setAccountNumber(b.accountNumber);
        if (b.ifscCode) setIfscCode(b.ifscCode);

        // Auto-select preferred payment method based on available onboarding data
        if (b.upiQrImage) {
            setPaymentMethod('qr');
        } else if (b.upiId) {
            setPaymentMethod('upi');
        } else if (b.bankName && b.accountNumber) {
            setPaymentMethod('bank_transfer');
        }
    };

    const refreshLimits = async () => {
        try {
            const resp = await sellerApi.getWithdrawalLimits().catch(() => null);
            const settings = resp?.data?.result || resp?.data?.data?.feeSettings || resp?.data?.data || resp?.data;
            if (settings) {
                const minV = settings.minWithdrawal;
                const maxV = settings.maxWithdrawal;
                setMinWithdrawal(minV != null && Number(minV) > 0 ? Number(minV) : null);
                setMaxWithdrawal(maxV != null && Number(maxV) > 0 ? Number(maxV) : null);
            }
        } catch (err) {}
    };

    useEffect(() => {
        let cancelled = false;
        const loadLimitsAndProfile = async () => {
            try {
                setLimitsLoading(true);
                const [limitsResp, profileResp] = await Promise.all([
                    sellerApi.getWithdrawalLimits().catch(() => null),
                    sellerApi.getProfile().catch(() => null),
                ]);

                if (!cancelled) {
                    const settings = limitsResp?.data?.result || limitsResp?.data?.data?.feeSettings || limitsResp?.data?.data || limitsResp?.data;
                    const minV = settings?.minWithdrawal;
                    const maxV = settings?.maxWithdrawal;
                    setMinWithdrawal(minV != null && Number(minV) > 0 ? Number(minV) : null);
                    setMaxWithdrawal(maxV != null && Number(maxV) > 0 ? Number(maxV) : null);

                    const profile = profileResp?.data?.result || profileResp?.data?.data;
                    if (profile) {
                        setSellerProfile(profile);
                        applyProfilePaymentInfo(profile);
                    }
                }
            } catch (err) {
                // silent — limits are UX hints; backend enforces
            } finally {
                if (!cancelled) setLimitsLoading(false);
            }
        };
        loadLimitsAndProfile();

        return () => {
            cancelled = true;
        };
    }, []);

    const ledger = Array.isArray(data?.ledger) ? data.ledger : [];
    const withdrawalHistory = ledger.filter((t) => (t.type || '').toString() === 'Withdrawal');

    const filteredHistory = useMemo(() => {
        const term = searchTerm.toLowerCase();
        const result = withdrawalHistory.filter((item) => {
            const id = (item.id ?? item.ref ?? '').toString().toLowerCase();
            const status = (item.status ?? '').toString().toLowerCase();
            const method = (item.method ?? item.customer ?? '').toString().toLowerCase();
            const amount = Math.abs(Number(item.amount ?? 0)).toString();
            return (
                !term ||
                id.includes(term) ||
                status.includes(term) ||
                method.includes(term) ||
                amount.includes(term)
            );
        });
        // Reset page if out of range
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

    const handleQrUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.error('Please upload a valid image file');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image must be under 5MB');
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            setQrPreview(ev.target.result);
            setQrBase64(ev.target.result);
        };
        reader.readAsDataURL(file);
    };

    const resetPaymentFields = () => {
        setPaymentMethod('upi');
        setUpiId('');
        setBankName('');
        setAccountHolderName('');
        setAccountNumber('');
        setIfscCode('');
        setQrPreview('');
        setQrBase64('');
    };

    const handleSubmitRequest = async (e) => {
        e.preventDefault();
        const settled = Number(data?.balances?.settledBalance ?? 0);
        const available = Math.max(0, settled);
        const amtNum = parseFloat(amount);

        if (!amount || amtNum <= 0) {
            toast.error('Please enter a valid withdrawal amount.');
            return;
        }
        if (minWithdrawal != null && amtNum < minWithdrawal) {
            toast.error(`Minimum withdrawal amount is ₹${minWithdrawal.toLocaleString()}.`);
            return;
        }
        if (maxWithdrawal != null && amtNum > maxWithdrawal) {
            toast.error(`Maximum withdrawal amount is ₹${maxWithdrawal.toLocaleString()}.`);
            return;
        }
        if (amtNum > available) {
            toast.error(`Insufficient balance. Available: ₹${available.toLocaleString()}.`);
            return;
        }

        const effectiveUpiId = upiId.trim() || sellerProfile?.bankInfo?.upiId || '';
        const effectiveQrImage = qrBase64 || qrPreview || sellerProfile?.bankInfo?.upiQrImage || '';
        const effectiveBankName = bankName.trim() || sellerProfile?.bankInfo?.bankName || '';
        const effectiveHolderName = accountHolderName.trim() || sellerProfile?.bankInfo?.accountHolderName || sellerProfile?.name || '';
        const effectiveAccountNumber = accountNumber.trim() || sellerProfile?.bankInfo?.accountNumber || '';
        const effectiveIfsc = ifscCode.trim().toUpperCase() || sellerProfile?.bankInfo?.ifscCode?.toUpperCase() || '';

        if (paymentMethod === 'upi' && !effectiveUpiId) {
            toast.error('Please enter your UPI ID');
            return;
        }
        if (paymentMethod === 'qr' && !effectiveQrImage) {
            toast.error('Please upload your QR code image');
            return;
        }
        if (paymentMethod === 'bank_transfer') {
            if (!effectiveBankName || !effectiveHolderName || !effectiveAccountNumber || !effectiveIfsc) {
                toast.error('Please fill all bank details (Bank Name, Account Holder, Account Number, IFSC)');
                return;
            }
        }

        try {
            setIsSubmitting(true);
            const payload = {
                amount: parseFloat(amount),
                paymentMethod,
                ...(paymentMethod === 'upi' && { upiId: effectiveUpiId }),
                ...(paymentMethod === 'qr' && { qrCodeImage: effectiveQrImage }),
                ...(paymentMethod === 'bank_transfer' && {
                    bankName: effectiveBankName,
                    accountHolderName: effectiveHolderName,
                    accountNumber: effectiveAccountNumber,
                    ifscCode: effectiveIfsc,
                }),
            };
            const response = await sellerApi.requestWithdrawal(payload);
            if (response.data.success) {
                toast.success('Withdrawal request submitted successfully!');
                setIsModalOpen(false);
                setAmount('');
                resetPaymentFields();
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

    const amtNum = parseFloat(amount) || 0;
    const availableBalance = balances.available;
    const remainingBalance = Math.max(0, availableBalance - amtNum);
    const isAmountOverAvailable = amtNum > availableBalance;
    const isAmountBelowMin = minWithdrawal != null && minWithdrawal > 0 && amtNum > 0 && amtNum < minWithdrawal;
    const isAmountAboveMax = maxWithdrawal != null && maxWithdrawal > 0 && amtNum > maxWithdrawal;
    const hasAmountError = amtNum > 0 && (isAmountOverAvailable || isAmountBelowMin || isAmountAboveMax);
    const isAmountValid = amtNum > 0 && !hasAmountError;

    return (
        <div className="space-y-8 pb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <BlurFade delay={0.1}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                            Money Requests
                            <div className="p-1.5 bg-[#fde8ea] rounded-lg">
                                <Wallet className="h-5 w-5 text-primary" />
                            </div>
                        </h1>
                        <p className="text-slate-600 text-base mt-1 font-medium">Request payouts and track your withdrawal history.</p>
                    </div>
                    <button
                        onClick={() => {
                            if (sellerProfile) applyProfilePaymentInfo(sellerProfile);
                            setIsModalOpen(true);
                        }}
                        className="px-6 py-3 bg-[#E71D28] hover:bg-primary-hover active:bg-primary-dark text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 flex items-center gap-2 group"
                    >
                        <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        New Request
                    </button>
                </div>
            </BlurFade>

            {/* Withdrawal Limits Info Banner */}
            {(minWithdrawal != null || maxWithdrawal != null) && (
                <BlurFade delay={0.18}>
                    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#fde8ea] bg-[#fef4f4]/70 px-5 py-4 shadow-sm">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-primary shadow-sm ring-1 ring-slate-100">
                            <Info className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            {minWithdrawal != null && (
                                <p className="text-xs font-black text-slate-700 uppercase tracking-widest">
                                    Minimum&nbsp;Withdrawal&nbsp;
                                    <span className="text-primary font-black">₹{minWithdrawal.toLocaleString()}</span>
                                </p>
                            )}
                            {minWithdrawal != null && maxWithdrawal != null && (
                                <span className="text-slate-300 font-bold">•</span>
                            )}
                            {maxWithdrawal != null && (
                                <p className="text-xs font-black text-slate-700 uppercase tracking-widest">
                                    Maximum&nbsp;Withdrawal&nbsp;
                                    <span className="text-primary font-black">₹{maxWithdrawal.toLocaleString()}</span>
                                </p>
                            )}
                        </div>
                    </div>
                </BlurFade>
            )}

            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <BlurFade delay={0.2}>
                    <Card className="p-6 relative overflow-hidden bg-white/70 backdrop-blur-md border border-slate-100/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_25px_rgba(0,0,0,0.06)] transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="h-12 w-12 rounded-2xl bg-[#fef4f4] border border-[#fde8ea] flex items-center justify-center text-primary">
                                <Wallet className="h-6 w-6" />
                            </div>
                        </div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Available Balance</p>
                        <h3 className="text-3xl font-black text-slate-900 mt-1">₹{balances.available.toLocaleString()}</h3>
                        <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-400">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            Ready to withdraw
                        </div>
                    </Card>
                </BlurFade>

                <BlurFade delay={0.25}>
                    <Card className="p-6 relative overflow-hidden bg-white/70 backdrop-blur-md border border-slate-100/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_25px_rgba(0,0,0,0.06)] transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="h-12 w-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                                <Clock className="h-6 w-6" />
                            </div>
                        </div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Pending Payouts</p>
                        <h3 className="text-3xl font-black text-slate-900 mt-1">₹{balances.pending.toLocaleString()}</h3>
                        <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-400">
                            <span className="h-2 w-2 rounded-full bg-amber-400" />
                            Processing requests
                        </div>
                    </Card>
                </BlurFade>

                <BlurFade delay={0.3}>
                    <Card className="p-6 relative overflow-hidden bg-white/70 backdrop-blur-md border border-slate-100/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_25px_rgba(0,0,0,0.06)] transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                                <CheckCircle2 className="h-6 w-6" />
                            </div>
                        </div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Last Withdrawal</p>
                        <h3 className="text-3xl font-black text-slate-900 mt-1">₹{balances.lastWithdrawal.toLocaleString()}</h3>
                        <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-400">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Sent to bank
                        </div>
                    </Card>
                </BlurFade>
            </div>

            {/* History Table */}
            <BlurFade delay={0.35}>
                <Card className="p-6 bg-white/70 backdrop-blur-md border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-3xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                                <History className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-900">Withdrawal History</h3>
                                <p className="text-xs text-slate-400 font-medium">All payout requests and their current status</p>
                            </div>
                        </div>

                        <div className="relative">
                            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Search ID or Status..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium focus:bg-white focus:border-primary/20 outline-none transition-all w-full sm:w-56"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <th className="pb-4">Request Details</th>
                                    <th className="pb-4">Amount</th>
                                    <th className="pb-4">Status</th>
                                    <th className="pb-4">Method</th>
                                    <th className="pb-4 text-right">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-xs font-medium">
                                {paginatedHistory.length > 0 ? (
                                    paginatedHistory.map((item) => (
                                        <tr key={item.id || item._id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="py-4">
                                                <p className="font-bold text-slate-900">{item.id || item.ref || item.reference || '—'}</p>
                                                <p className="text-[10px] text-slate-400">Ref: {item.reference || item.ref || item.orderId || '—'}</p>
                                            </td>
                                            <td className="py-4 font-black text-slate-900">
                                                ₹{Math.abs(Number(item.amount ?? 0)).toLocaleString()}
                                            </td>
                                            <td className="py-4">
                                                <span
                                                    className={cn(
                                                        "text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5",
                                                        (item.status || '').toLowerCase() === 'settled'
                                                            ? "bg-emerald-50 text-emerald-700"
                                                            : (item.status || '').toLowerCase() === 'pending'
                                                            ? "bg-amber-50 text-amber-700"
                                                            : "bg-rose-50 text-rose-700"
                                                    )}
                                                >
                                                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                                    {item.status || 'Pending'}
                                                </span>
                                            </td>
                                            <td className="py-4 text-slate-500 font-bold">
                                                {item.method || item.customer || 'Bank Transfer'}
                                            </td>
                                            <td className="py-4 text-right text-slate-400">
                                                {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="text-center py-12 text-slate-400 font-medium">
                                            No withdrawal records found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {filteredHistory.length > pageSize && (
                        <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                            <Pagination
                                currentPage={page}
                                totalPages={Math.max(1, Math.ceil(filteredHistory.length / pageSize))}
                                onPageChange={setPage}
                            />
                        </div>
                    )}
                </Card>
            </BlurFade>

            {/* Request Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => !isSubmitting && setIsModalOpen(false)}
                title="Request Withdrawal"
            >
                <form onSubmit={handleSubmitRequest} className="space-y-6 py-4">
                    {/* Available & Remaining Balance Card */}
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Available to Withdraw</p>
                            <h4 className="text-2xl font-black text-[#E71D28]">₹{balances.available.toLocaleString()}</h4>
                        </div>
                        {amtNum > 0 && (
                            <div className={cn(
                                "text-right px-3.5 py-2 rounded-xl border transition-all",
                                isAmountOverAvailable
                                    ? "bg-rose-50 border-rose-200 text-rose-700"
                                    : "bg-emerald-50 border-emerald-200 text-emerald-800"
                            )}>
                                <p className="text-[10px] font-black uppercase tracking-wider">Remaining Balance</p>
                                <p className="text-base font-black">
                                    {isAmountOverAvailable ? '₹0' : `₹${remainingBalance.toLocaleString()}`}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Withdrawal Limits Notice */}
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3.5 text-xs shadow-sm">
                        <div className="flex items-center gap-2.5 text-amber-900 font-bold">
                            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">Withdrawal Limit Range</p>
                                <p className="text-xs sm:text-sm font-black text-amber-950">
                                    {minWithdrawal != null && maxWithdrawal != null
                                        ? `Min ₹${minWithdrawal.toLocaleString()} — Max ₹${maxWithdrawal.toLocaleString()}`
                                        : minWithdrawal != null
                                        ? `Minimum: ₹${minWithdrawal.toLocaleString()}`
                                        : maxWithdrawal != null
                                        ? `Maximum: ₹${maxWithdrawal.toLocaleString()}`
                                        : 'No limits set by admin'}
                                </p>
                            </div>
                        </div>
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-amber-200/80 text-amber-900 uppercase tracking-wider shrink-0 border border-amber-300/50">
                            Admin Policy
                        </span>
                    </div>

                    <div className="space-y-4">
                        {/* Amount Input */}
                        <div>
                            <div className="flex items-center justify-between mb-2 ml-1">
                                <label className="text-xs font-black text-slate-600 uppercase tracking-widest block">
                                    Enter Amount
                                </label>
                                {(minWithdrawal != null || maxWithdrawal != null) && (
                                    <span className="text-[11px] font-bold text-slate-500">
                                        Range: ₹{minWithdrawal ? minWithdrawal.toLocaleString() : '1'} – ₹{maxWithdrawal ? maxWithdrawal.toLocaleString() : '∞'}
                                    </span>
                                )}
                            </div>
                            <div className="relative group">
                                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300 group-focus-within:text-primary transition-colors">
                                    ₹
                                </span>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder={
                                        minWithdrawal != null && maxWithdrawal != null
                                            ? `Between ${minWithdrawal.toLocaleString()} and ${maxWithdrawal.toLocaleString()}`
                                            : minWithdrawal != null
                                            ? `Min ${minWithdrawal.toLocaleString()}`
                                            : maxWithdrawal != null
                                            ? `Max ${maxWithdrawal.toLocaleString()}`
                                            : '0.00'
                                    }
                                    className={cn(
                                        "w-full pl-12 pr-6 py-4 bg-white ring-1 focus:ring-2 rounded-2xl text-xl font-black outline-none transition-all placeholder:text-slate-300",
                                        hasAmountError
                                            ? "ring-rose-300 focus:ring-rose-400 focus:border-rose-400 text-rose-600"
                                            : "ring-slate-200 focus:ring-primary/20 focus:border-primary"
                                    )}
                                />
                            </div>

                            {/* Real-time Status / Error Feedback */}
                            {isAmountOverAvailable ? (
                                <p className="mt-2 text-xs font-bold text-rose-600 flex items-center gap-1.5">
                                    <XCircle className="h-4 w-4 shrink-0" />
                                    Amount exceeds available balance! Available: ₹{balances.available.toLocaleString()}
                                </p>
                            ) : isAmountBelowMin ? (
                                <p className="mt-2 text-xs font-bold text-rose-600 flex items-center gap-1.5">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    Amount is below minimum limit! You must enter at least ₹{minWithdrawal.toLocaleString()}
                                </p>
                            ) : isAmountAboveMax ? (
                                <p className="mt-2 text-xs font-bold text-rose-600 flex items-center gap-1.5">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    Amount exceeds maximum limit! You can enter at most ₹{maxWithdrawal.toLocaleString()}
                                </p>
                            ) : amtNum > 0 ? (
                                <p className="mt-2 text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                                    Valid Amount • ₹{remainingBalance.toLocaleString()} will remain in your wallet
                                </p>
                            ) : (
                                <p className="mt-2 text-[11px] font-semibold text-slate-500 ml-1">
                                    {minWithdrawal != null && maxWithdrawal != null
                                        ? `Enter an amount between ₹${minWithdrawal.toLocaleString()} and ₹${maxWithdrawal.toLocaleString()} to request payout.`
                                        : 'Enter the amount you wish to withdraw.'}
                                </p>
                            )}

                            {minWithdrawal != null && balances.available < minWithdrawal && (
                                <div className="mt-2.5 p-3 bg-rose-50 border border-rose-200/80 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                                    <span>Available balance (₹{balances.available.toLocaleString()}) is currently below minimum required withdrawal (₹{minWithdrawal.toLocaleString()}).</span>
                                </div>
                            )}
                        </div>

                        {/* Payment Method Selector (Read-Only Info) */}
                        <div>
                            <div className="flex items-center justify-between mb-3 px-1">
                                <label className="text-xs font-black text-slate-600 uppercase tracking-widest block">
                                    Payment Method
                                </label>
                                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                                    <Lock className="h-3 w-3 text-slate-500" /> Non-editable (From Profile)
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-2xl">
                                {[
                                    { key: 'upi', label: 'UPI ID' },
                                    { key: 'qr', label: 'QR Code' },
                                    { key: 'bank_transfer', label: 'Bank' },
                                ].map((m) => (
                                    <button
                                        key={m.key}
                                        type="button"
                                        onClick={() => setPaymentMethod(m.key)}
                                        className={cn(
                                            "py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                            paymentMethod === m.key
                                                ? "bg-white text-slate-900 shadow-sm"
                                                : "text-slate-400 hover:text-slate-600"
                                        )}
                                    >
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* UPI Details (Non-editable / Locked) */}
                        {paymentMethod === 'upi' && (
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                                        <Lock className="h-3 w-3 text-slate-400" /> Registered UPI ID
                                    </p>
                                    <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                        Onboarding Verified
                                    </span>
                                </div>
                                <div className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-900 select-all cursor-default">
                                    {upiId || sellerProfile?.bankInfo?.upiId || 'No UPI ID registered'}
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium italic">
                                    Payout will be sent to your verified registered UPI ID.
                                </p>
                            </div>
                        )}

                        {/* QR Code (Non-editable / Locked) */}
                        {paymentMethod === 'qr' && (
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                                        <Lock className="h-3 w-3 text-slate-400" /> Registered QR Code
                                    </p>
                                    <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                        Onboarding Verified
                                    </span>
                                </div>
                                {qrPreview || sellerProfile?.bankInfo?.upiQrImage ? (
                                    <div className="text-center p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                                        <img
                                            src={qrPreview || sellerProfile?.bankInfo?.upiQrImage}
                                            alt="Registered QR Code"
                                            className="w-full max-w-[200px] max-h-[220px] object-contain mx-auto rounded-xl"
                                        />
                                        <p className="text-[10px] text-slate-400 font-medium italic mt-2.5">
                                            Admin will scan your registered QR code to process the payout.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="p-6 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs font-bold">
                                        No QR code was registered during onboarding.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Bank Details (Non-editable / Locked) */}
                        {paymentMethod === 'bank_transfer' && (
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                                        <Lock className="h-3 w-3 text-slate-400" /> Registered Bank Account
                                    </p>
                                    <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                        Onboarding Verified
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Bank Name</p>
                                        <p className="font-black text-slate-900 mt-0.5 truncate">{bankName || sellerProfile?.bankInfo?.bankName || '—'}</p>
                                    </div>
                                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Account Holder</p>
                                        <p className="font-black text-slate-900 mt-0.5 truncate">{accountHolderName || sellerProfile?.bankInfo?.accountHolderName || sellerProfile?.name || '—'}</p>
                                    </div>
                                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Account Number</p>
                                        <p className="font-black text-slate-900 mt-0.5 truncate">{accountNumber || sellerProfile?.bankInfo?.accountNumber || '—'}</p>
                                    </div>
                                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">IFSC Code</p>
                                        <p className="font-black text-slate-900 mt-0.5 uppercase truncate">{ifscCode || sellerProfile?.bankInfo?.ifscCode || '—'}</p>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium italic">
                                    Payout will be transferred directly to this registered bank account.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-3 pt-4">
                        <button
                            type="submit"
                            disabled={isSubmitting || hasAmountError || amtNum <= 0}
                            className="w-full py-4 bg-[#E71D28] hover:bg-primary-hover active:bg-primary-dark text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                        >
                            {isSubmitting ? <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : 'SUBMIT WITHDRAWAL REQUEST'}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setIsModalOpen(false); resetPaymentFields(); }}
                            className="w-full py-2 text-xs font-black text-slate-600 uppercase tracking-widest hover:text-slate-600 transition-colors"
                        >
                            Nevermind, keep funds
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Withdrawals;
