import React, { useState, useMemo, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Pagination from '@shared/components/ui/Pagination';
import { PAGINATION_CONFIG } from '@/shared/constants/pagination';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Download, Filter, Search, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildTransactionCsvRows, downloadCsv } from '../utils/csvExportUtils';
import { getQuickOrderMoneyBreakdown, isQuickOrderCancelled } from '../utils/orderMoneyBreakdown';

const TransactionReport = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [isExporting, setIsExporting] = useState(false);
    const [orders, setOrders] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGINATION_CONFIG.defaultPageSize);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchTransactions = async (requestedPage = 1) => {
        try {
            setLoading(true);
            const res = await adminApi.getOrders({ page: requestedPage, limit: pageSize });
            if (res.data.success) {
                const payload = res.data.result || {};
                const data = Array.isArray(payload.items) ? payload.items : (res.data.results || []);
                setOrders(data);
                setTotal(typeof payload.total === 'number' ? payload.total : data.length);
                setPage(typeof payload.page === 'number' ? payload.page : requestedPage);
            }
        } catch (error) {
            toast.error("Failed to fetch transactions");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize]);

    const stats = useMemo(() => {
        let totalUserPaid = 0;
        let totalSellerEarned = 0;
        let adminEarned = 0;
        let deliveryEarned = 0;

        orders.forEach((order) => {
            // Cancelled orders must not inflate paid-earning cards.
            if (isQuickOrderCancelled(order)) return;
            const breakdown = getQuickOrderMoneyBreakdown(order);
            totalUserPaid += breakdown.userPaid;
            adminEarned += breakdown.adminEarned;
            deliveryEarned += breakdown.riderEarned;
            totalSellerEarned += breakdown.sellerEarned;
        });

        return {
            totalUserPaid,
            totalSellerEarned,
            adminEarned,
            deliveryEarned
        };
    }, [orders]);

    const filterOrders = (list) => list.filter((o) => {
        const orderIdStr = String(o.orderId || o.orderNumber || '').toLowerCase();
        const customerStr = String(o.customer?.name || '').toLowerCase();
        const sellerStr = String(o.storeName || o.seller?.shopName || o.seller?.name || '').toLowerCase();
        const search = searchTerm.toLowerCase();
        const status = String(o.status || o.orderStatus || '').toLowerCase();

        const matchesSearch = orderIdStr.includes(search) || customerStr.includes(search) || sellerStr.includes(search);
        const matchesStatus =
            filterStatus === 'all' ||
            (filterStatus === 'cancelled'
                ? status.includes('cancel')
                : status === filterStatus.toLowerCase());

        return matchesSearch && matchesStatus;
    });

    const filteredOrders = useMemo(() => filterOrders(orders), [orders, searchTerm, filterStatus]);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const res = await adminApi.getOrders({
                page: 1,
                limit: 1000,
                ...(filterStatus !== 'all' ? { status: filterStatus } : {}),
            });

            const payload = res.data?.result || {};
            const allOrders = Array.isArray(payload.items) ? payload.items : (res.data?.results || []);
            const exportOrders = filterOrders(allOrders);

            if (!exportOrders.length) {
                toast.error('No transactions available to export');
                return;
            }

            const downloaded = downloadCsv(
                buildTransactionCsvRows(exportOrders),
                `transaction-report-${new Date().toISOString().split('T')[0]}.csv`,
            );

            if (downloaded) {
                toast.success('Report exported successfully');
            }
        } catch (error) {
            console.error('Transaction export error:', error);
            toast.error('Failed to export transaction report');
        } finally {
            setIsExporting(false);
        }
    };

    if (loading && page === 1 && orders.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Loading Report...</p>
            </div>
        );
    }

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Finance Reports</span>
                    </div>
                    <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
                        Transaction Report
                    </h1>
                    <p className="text-sm font-medium text-slate-500 mt-1">Detailed breakdown of all quick commerce order transactions</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchTransactions(1)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white ring-1 ring-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                        Refresh
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg active:scale-95 group disabled:opacity-50"
                    >
                        {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 group-hover:-translate-y-0.5 transition-transform" />}
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                <Card className="px-5 py-4 border border-slate-100 shadow-sm bg-white rounded-[20px]">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total User Paid</p>
                    <h3 className="text-2xl font-black text-indigo-600">₹{stats.totalUserPaid.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h3>
                </Card>
                <Card className="px-5 py-4 border border-slate-100 shadow-sm bg-white rounded-[20px]">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Sellers Earning</p>
                    <h3 className="text-2xl font-black text-emerald-500">₹{stats.totalSellerEarned.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h3>
                </Card>
                <Card className="px-5 py-4 border border-slate-100 shadow-sm bg-white rounded-[20px]">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Admin Earning</p>
                    <h3 className="text-2xl font-black text-purple-600">₹{stats.adminEarned.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h3>
                </Card>
                <Card className="px-5 py-4 border border-slate-100 shadow-sm bg-white rounded-[20px]">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Rider Earning</p>
                    <h3 className="text-2xl font-black text-orange-500">₹{stats.deliveryEarned.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h3>
                </Card>
            </div>

            {/* Filter & Search Bar */}
            <Card className="p-3 border border-slate-100 shadow-sm bg-white rounded-2xl mt-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full md:w-[400px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by Order ID, Customer, or Seller..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                </div>
                
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 w-full md:w-auto">
                        <Filter className="h-4 w-4 text-slate-400" />
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer w-full md:w-auto"
                        >
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="processed">Processed</option>
                            <option value="out_for_delivery">Out for Delivery</option>
                            <option value="delivered">Completed / Delivered</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                </div>
            </Card>

            {/* Table Area */}
            <Card className="border border-slate-100 shadow-sm overflow-hidden bg-white rounded-2xl mt-6">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-700 uppercase tracking-widest whitespace-nowrap">Order ID & Date</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-700 uppercase tracking-widest">Customer</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-700 uppercase tracking-widest">Seller</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-700 uppercase tracking-widest whitespace-nowrap">Delivery Boy</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-700 uppercase tracking-widest whitespace-nowrap">User Paid</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-700 uppercase tracking-widest whitespace-nowrap">Seller Earned</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-700 uppercase tracking-widest whitespace-nowrap">Rider Earned</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-700 uppercase tracking-widest whitespace-nowrap">Admin Earned</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-700 uppercase tracking-widest">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredOrders.map((order) => {
                                const dateStr = order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN', {
                                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                }) : 'N/A';

                                const {
                                    userPaid,
                                    userPaidGross,
                                    refundedAmount,
                                    platformFee,
                                    deliveryFee,
                                    tax,
                                    refundedTaxShare,
                                    subtotal,
                                    packingFee,
                                    returnPickupFee,
                                    returnPickupPaidByAdmin,
                                    discount,
                                    adminDiscount,
                                    commission,
                                    sellerEarned,
                                    deliveryRiderEarning,
                                    returnRiderEarning,
                                    riderEarned,
                                    adminEarned,
                                    deliveryMargin,
                                    hasReturn,
                                } = getQuickOrderMoneyBreakdown(order);

                                return (
                                    <tr key={order.id} className="hover:bg-slate-50/40 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-slate-900">{order.orderId || order.orderNumber || order._id}</span>
                                                <span className="text-[10px] font-semibold text-slate-500 mt-0.5">{dateStr}</span>
                                                {hasReturn && (
                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 mt-1 w-fit">
                                                        Return
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-bold text-slate-700">{order.customer?.name || 'Guest'}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-700">{order.storeName || order.seller?.shopName || order.seller?.name || 'Unknown'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-bold text-slate-700">{order.deliveryBoy?.name || order.deliveryPartner?.name || order.dispatch?.deliveryPartnerId?.name || order.dispatch?.rider?.name || order.rider?.name || 'N/A'}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-slate-900 mb-1">₹{userPaid.toFixed(2)}</span>
                                                {refundedAmount > 0 && (
                                                    <span className="text-[9px] font-semibold text-rose-600 mb-1">
                                                        Paid ₹{userPaidGross.toFixed(2)} − refund ₹{refundedAmount.toFixed(2)}
                                                    </span>
                                                )}
                                                <div className="grid grid-cols-[auto_1fr] gap-x-2 text-[9px] font-medium text-slate-400">
                                                    <span>Subtotal:</span><span className="text-right">₹{subtotal.toFixed(2)}</span>
                                                    <span>Delivery:</span><span className="text-right">₹{deliveryFee.toFixed(2)}</span>
                                                    <span>Tax/GST:</span><span className="text-right">₹{tax.toFixed(2)}</span>
                                                    {refundedTaxShare > 0 && (
                                                        <>
                                                            <span>GST refunded:</span><span className="text-right text-rose-500">-₹{refundedTaxShare.toFixed(2)}</span>
                                                        </>
                                                    )}
                                                    <span>Platform:</span><span className="text-right">₹{platformFee.toFixed(2)}</span>
                                                    {packingFee > 0 && (
                                                        <>
                                                            <span>Packing (seller):</span><span className="text-right">₹{packingFee.toFixed(2)}</span>
                                                        </>
                                                    )}
                                                    {returnPickupFee > 0 && (
                                                        <>
                                                            <span>Return pickup (seller, historical):</span><span className="text-right text-rose-500">-₹{returnPickupFee.toFixed(2)}</span>
                                                        </>
                                                    )}
                                                    {returnPickupPaidByAdmin > 0 && (
                                                        <>
                                                            <span>Return pickup (admin):</span><span className="text-right text-rose-500">-₹{returnPickupPaidByAdmin.toFixed(2)}</span>
                                                        </>
                                                    )}
                                                    {(adminDiscount > 0 || discount > 0) && (
                                                        <>
                                                            <span>Discount:</span><span className="text-right">-₹{(adminDiscount > 0 ? adminDiscount : discount).toFixed(2)}</span>
                                                        </>
                                                    )}
                                                    {commission > 0 && (
                                                        <>
                                                            <span>Commission:</span><span className="text-right">₹{commission.toFixed(2)}</span>
                                                        </>
                                                    )}
                                                    <span>Del. margin:</span><span className="text-right">₹{deliveryMargin.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "text-sm font-black",
                                                sellerEarned < 0 ? "text-rose-500" : "text-emerald-500",
                                            )}>₹{sellerEarned.toFixed(2)}</span>
                                            {packingFee > 0 && refundedAmount > 0 && (
                                                <p className="text-[9px] font-medium text-slate-400 mt-0.5">
                                                    {returnPickupFee > 0
                                                        ? `packing ₹${packingFee.toFixed(0)} − pickup ₹${returnPickupFee.toFixed(0)}`
                                                        : 'incl. packing'}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-black text-indigo-600">₹{riderEarned.toFixed(2)}</span>
                                            {(deliveryRiderEarning > 0 || returnRiderEarning > 0) && (
                                                <p className="text-[9px] font-medium text-slate-400 mt-0.5">
                                                    {returnRiderEarning > 0
                                                        ? `delivery ₹${deliveryRiderEarning.toFixed(0)} + return ₹${returnRiderEarning.toFixed(0)}`
                                                        : 'delivery'}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "text-sm font-black",
                                                adminEarned < 0 ? "text-rose-600" : "text-purple-600",
                                            )}>₹{adminEarned.toFixed(2)}</span>
                                            {refundedTaxShare > 0 && (
                                                <p className="text-[9px] font-medium text-rose-500 mt-0.5">after GST refund</p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge
                                                variant={
                                                    order.status === 'delivered' || order.status === 'completed'
                                                        ? 'success'
                                                        : String(order.status || '').includes('cancel')
                                                          ? 'danger'
                                                          : 'secondary'
                                                }
                                                className="text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider font-bold"
                                            >
                                                {order.status === 'delivered'
                                                    ? 'Completed'
                                                    : String(order.status || '').includes('cancel')
                                                      ? 'Cancelled'
                                                      : order.status}
                                            </Badge>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredOrders.length === 0 && !loading && (
                                <tr>
                                    <td colSpan="9" className="px-6 py-12 text-center text-slate-400 font-bold text-sm">
                                        No transactions found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/30">
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
                        loading={loading}
                    />
                </div>
            </Card>
        </div>
    );
};

export default TransactionReport;
