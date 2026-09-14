import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, ArrowDownLeft, ChevronLeft, Wallet } from 'lucide-react';
import { customerApi } from '../services/customerApi';

const formatDate = (d) => {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today) return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ', ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const mapWalletTransaction = (tx) => {
    const type = String(tx?.type || '').toLowerCase();
    const isCredit = ['addition', 'refund', 'credit'].includes(type);
    const orderId = tx?.metadata?.orderId || '';
    const title =
        type === 'refund'
            ? 'Order Refund'
            : type === 'deduction'
                ? 'Order Payment'
                : tx?.description || 'Wallet Transaction';

    return {
        _id: tx.id || tx._id || `${title}-${tx.createdAt || tx.date}`,
        type: isCredit ? 'credit' : 'debit',
        title,
        amount: Number(tx.amount || 0),
        date: tx.createdAt || tx.date,
        orderId,
    };
};

const WalletPage = () => {
    const navigate = useNavigate();
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const walletRes = await customerApi.getWalletBalance();
                const wallet = walletRes?.data?.data?.wallet || walletRes?.data?.result?.wallet || {};
                const rawTransactions = Array.isArray(wallet?.transactions) ? wallet.transactions : [];
                setBalance(Number(wallet?.balance || 0));
                setTransactions(rawTransactions.map(mapWalletTransaction));
            } catch (err) {
                console.error('Wallet fetch error:', err);
                setBalance(0);
                setTransactions([]);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-background pb-24 font-sans transition-colors">
            <div className="sticky top-0 z-30 bg-slate-50/95 dark:bg-background/95 backdrop-blur-sm px-4 pt-4 pb-3 border-b border-slate-200/60 dark:border-white/5 mb-4 flex items-center gap-2">
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 flex items-center justify-center hover:bg-slate-200/70 dark:hover:bg-slate-800/70 rounded-full transition-colors -ml-1"
                >
                    <ChevronLeft size={22} className="text-slate-800 dark:text-foreground" />
                </button>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-foreground tracking-tight">Wallet</h1>
            </div>

            <div className="max-w-2xl mx-auto px-4 pt-1 relative z-20 space-y-4">
                <div className="bg-white dark:bg-card rounded-xl border border-slate-200 dark:border-white/5 p-4">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Available Balance</p>
                    <h2 className="text-3xl font-semibold text-slate-900 dark:text-white mt-1">
                        {loading ? '...' : `₹${(balance || 0).toLocaleString('en-IN')}`}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">Quick order refunds are credited here automatically</p>
                </div>

                <div className="bg-white dark:bg-card rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                        <h3 className="text-base font-semibold text-slate-800 dark:text-white">Transaction History</h3>
                        <Wallet size={18} className="text-slate-400 dark:text-slate-500" />
                    </div>

                    {loading ? (
                        <div className="py-12 flex justify-center text-slate-400 text-sm font-semibold">
                            Loading...
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="py-12 flex flex-col items-center justify-center text-center px-6">
                            <p className="text-sm font-semibold text-slate-500 mb-1">No wallet transactions yet</p>
                            <p className="text-xs text-slate-400">
                                Wallet payments and refunds will appear here.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {transactions.map((tx) => (
                                <div key={tx._id} className="px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${tx.type === 'credit' ? 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                                            {tx.type === 'credit' ? <ArrowDownLeft size={19} /> : <ArrowUpRight size={19} />}
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{tx.title}</h4>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{formatDate(tx.date)}</p>
                                            {tx.orderId && (
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400">#{tx.orderId}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className={`text-sm font-semibold ${tx.type === 'credit' ? 'text-green-600 dark:text-green-400' : 'text-slate-900 dark:text-white'}`}>
                                        {tx.type === 'credit' ? '+' : '-'}₹{(tx.amount || 0).toLocaleString('en-IN')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WalletPage;
