// Comprehensive Order Management System
import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Pagination from '@shared/components/ui/Pagination';
import { adminApi } from '../services/adminApi';
import {
    Search,
    Filter,
    Truck,
    RotateCcw,
    MoreVertical,
    Eye,
    Trash2,
    Download,
    Calendar,
    ArrowUpRight,
    Package,
    MapPin,
    IndianRupee,
    ShoppingBag,
    Clock,
    CheckCircle2,
    XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@shared/components/ui/Toast';
import {
    getLegacyStatusFromOrder,
    adminRouteMatchesOrder,
} from '@/shared/utils/orderStatus';
import { joinOrderRoom, onOrderStatusUpdate } from "@/core/services/orderSocket";
import RefundModal from "@food/components/admin/orders/RefundModal";

const AUTO_REFRESH_INTERVAL_MS = 30000;

const DATE_RANGE_OPTIONS = [
    { id: 'all', label: 'All Time' },
    { id: 'today', label: 'Today' },
    { id: 'last7', label: 'Last 7 Days' },
    { id: 'last30', label: 'Last 30 Days' },
];

const PAYMENT_FILTER_OPTIONS = [
    { id: 'all', label: 'All Payments' },
    { id: 'cod', label: 'Cash / COD' },
    { id: 'digital', label: 'Digital' },
];

const formatOrderTimestamp = (value) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return 'NA';
    return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const matchesDateRange = (createdAt, rangeId) => {
    if (rangeId === 'all') return true;
    const createdAtDate = createdAt ? new Date(createdAt) : null;
    if (!createdAtDate || Number.isNaN(createdAtDate.getTime())) return false;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (rangeId === 'today') {
        return createdAtDate >= startOfToday;
    }

    const days = rangeId === 'last7' ? 7 : 30;
    const rangeStart = new Date(startOfToday);
    rangeStart.setDate(rangeStart.getDate() - (days - 1));
    return createdAtDate >= rangeStart;
};

const OrdersList = () => {
    const { status = 'all' } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState('All Time');
    const [dateRangeId, setDateRangeId] = useState('all');
    const [paymentFilter, setPaymentFilter] = useState('all');
    const [showDateMenu, setShowDateMenu] = useState(false);
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const [orders, setOrders] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refundModalOpen, setRefundModalOpen] = useState(false);
    const [selectedOrderForRefund, setSelectedOrderForRefund] = useState(null);
    const [processingRefund, setProcessingRefund] = useState(false);

    const getToken = () =>
        localStorage.getItem("admin_accessToken") ||
        localStorage.getItem("accessToken") ||
        "";

    const fetchOrders = async (requestedPage = 1, options = {}) => {
        const isBackgroundRefresh = options.background === true;
        if (isBackgroundRefresh) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }
        try {
            const params = { page: requestedPage, limit: pageSize };
            if (status !== 'all') params.status = status;
            const response = await adminApi.getOrders(params);
            if (response.data.success) {
                const payload = response.data.result || {};
                const dbOrders = Array.isArray(payload.items) ? payload.items : (response.data.results || []);
                const formatted = dbOrders.map(o => ({
                    // Payable amount = pricing.total (subtotal+delivery+handling+gst...) + platformFee
                    // Older backend payloads may still send amount as pricing.total only.
                    id: String(o.orderId || o._id || ''),
                    _id: o._id,
                    orderType: String(o.orderType || 'quick').toLowerCase(),
                    customer: String(o.customer?.name || o.sellerOrder?.customer?.name || 'Unknown'),
                    seller: String(o.seller?.shopName || o.storeName || 'Unknown'),
                    items: o.itemCount || o.items?.length || 0,
                    amount: (() => {
                        const pricingTotal = Number(o.pricing?.total ?? 0);
                        const platformFee = Number(o.pricing?.platformFee ?? 0);
                        const computedPayable = Math.max(0, pricingTotal + platformFee);
                        const provided = Number(o.amount);
                        if (Number.isFinite(platformFee) && platformFee > 0) return computedPayable;
                        return Number.isFinite(provided) ? provided : pricingTotal;
                    })(),
                    status: String(getLegacyStatusFromOrder(o) || 'pending'),
                    rawStatus: String(o.orderStatus || ''),
                    workflowStatus: o.workflowStatus,
                    workflowVersion: o.workflowVersion,
                    returnStatus: o.returnStatus,
                    createdAt: o.createdAt || null,
                    updatedAt: o.updatedAt || null,
                    date: formatOrderTimestamp(o.createdAt),
                    payment: o.payment?.method === 'cod' || o.payment?.method === 'cash' ? 'COD' : 'Digital',
                    paymentMethod: String(o.payment?.method || '').toLowerCase(),
                    refundStatus: o.payment?.refund?.status || (o.payment?.status === 'refunded' ? 'processed' : null),
                }));
                setOrders(formatted);
                formatted.forEach((row) => {
                    if (row?.id) joinOrderRoom(row.id, getToken);
                });
                if (typeof payload.total === 'number') {
                    setTotal(payload.total);
                } else {
                    setTotal(formatted.length);
                }
                if (typeof payload.page === 'number') {
                    setPage(payload.page);
                } else {
                    setPage(requestedPage);
                }
            }
        } catch (error) {
            console.error("Fetch orders error:", error);
            showToast("Failed to load orders", "error");
        } finally {
            if (isBackgroundRefresh) {
                setIsRefreshing(false);
            } else {
                setIsLoading(false);
            }
        }
    };

    const handleDeleteOrder = async (order) => {
        const orderLabel = String(order?.id || order?._id || '').trim();
        if (!orderLabel) {
            showToast("Order id is missing", "error");
            return;
        }

        const shouldDelete = window.confirm(
            `Delete order #${orderLabel} from quick-commerce, seller records, and DB? This cannot be undone.`
        );

        if (!shouldDelete) return;

        try {
            await adminApi.deleteOrder(orderLabel);
            showToast(`Order #${orderLabel} deleted`, "success");
            setOrders((prev) => (Array.isArray(prev) ? prev.filter((item) => item.id !== order.id) : prev));
            fetchOrders(page);
        } catch (error) {
            console.error("Failed to delete order:", error);
            showToast(error?.response?.data?.message || "Failed to delete order", "error");
        }
    };

    const handleRefundClick = (order) => {
        setSelectedOrderForRefund(order);
        setRefundModalOpen(true);
    };

    const processRefund = async (orderIdToUse, refundAmount = null, refundTo = null) => {
        if (!orderIdToUse) return;
        setProcessingRefund(true);
        try {
            const requestData = {};
            if (refundAmount) requestData.refundAmount = refundAmount;
            if (refundTo) requestData.refundTo = refundTo;

            const response = await adminApi.processRefund(orderIdToUse, requestData);
            if (response.data.success) {
                showToast("Refund processed successfully", "success");
                setRefundModalOpen(false);
                setSelectedOrderForRefund(null);
                fetchOrders(page);
            } else {
                showToast(response.data.message || "Failed to process refund", "error");
            }
        } catch (error) {
            console.error("Refund error:", error);
            showToast(error?.response?.data?.message || "Failed to process refund", "error");
        } finally {
            setProcessingRefund(false);
        }
    };

    useEffect(() => {
        fetchOrders(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize, status]);

    useEffect(() => {
        const interval = window.setInterval(() => {
            fetchOrders(page, { background: true });
        }, AUTO_REFRESH_INTERVAL_MS);

        return () => window.clearInterval(interval);
    }, [page, pageSize, status]);

    useEffect(() => {
        const off = onOrderStatusUpdate(getToken, (payload) => {
            const orderId = String(payload?.orderId || "").trim();
            if (!orderId) return;
            const raw = String(payload?.sellerStatus || payload?.orderStatus || "").trim().toLowerCase();
            if (!raw) return;
            const nextStatus =
                raw === "picked_up" ? "out_for_delivery" :
                    raw === "placed" || raw === "created" ? "pending" :
                        raw;

            setOrders((prev) =>
                (Array.isArray(prev) ? prev : []).map((row) =>
                    String(row?.id || "") === orderId
                        ? {
                            ...row,
                            rawStatus: payload?.orderStatus ?? row.rawStatus,
                            status: nextStatus,
                        }
                        : row
                )
            );
        });

        return () => off?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const safeOrders = useMemo(
        () => (Array.isArray(orders) ? orders : []),
        [orders]
    );

    const stats = useMemo(() => {
        const totalEarnings = safeOrders.reduce((sum, o) => sum + o.amount, 0);
        const activeOrders = safeOrders.filter(o =>
            ['pending', 'confirmed', 'packed', 'ready_for_pickup', 'out_for_delivery'].includes(o.status),
        ).length;

        return [
            { label: 'Total Earnings', value: `₹${totalEarnings.toLocaleString('en-IN')}`, trend: '+12.5%', icon: IndianRupee, color: 'emerald' },
            { label: 'Active Orders', value: activeOrders, trend: '+5', icon: ShoppingBag, color: 'orange' },
            { label: 'Average Prep Time', value: '18m', trend: '-2m', icon: Clock, color: 'amber' },
            { label: 'Delivery Rate', value: '98.2%', trend: '+0.4%', icon: CheckCircle2, color: 'fuchsia' },
        ];
    }, [safeOrders]);

    const filteredOrders = useMemo(() => {
        return safeOrders.filter(order => {
            const orderId = String(order?.id || '').toLowerCase();
            const customerName = String(order?.customer || '').toLowerCase();
            const sellerName = String(order?.seller || '').toLowerCase();
            const term = String(searchTerm || '').toLowerCase();
            const matchesSearch =
                orderId.includes(term) ||
                customerName.includes(term) ||
                sellerName.includes(term);

            const matchesStatus = adminRouteMatchesOrder(status, order);
            const matchesDate = matchesDateRange(order.createdAt, dateRangeId);
            const matchesPayment =
                paymentFilter === 'all' ||
                (paymentFilter === 'cod'
                    ? ['cod', 'cash'].includes(order.paymentMethod)
                    : !['cod', 'cash'].includes(order.paymentMethod));

            return matchesSearch && matchesStatus && matchesDate && matchesPayment;
        });
    }, [safeOrders, searchTerm, status, dateRangeId, paymentFilter]);

    const getStatusStyles = (status) => {
        switch (status.toLowerCase()) {
            case 'pending': return 'bg-amber-100 text-amber-600 border-amber-200';
            case 'confirmed': return 'bg-orange-100 text-primary border-orange-200';
            case 'packed': return 'bg-orange-100 text-primary border-orange-200';
            case 'ready_for_pickup': return 'bg-orange-100 text-primary border-orange-200';
            case 'out_for_delivery': return 'bg-orange-100 text-primary border-orange-200';
            case 'delivered': return 'bg-emerald-100 text-emerald-600 border-emerald-200';
            case 'cancelled': return 'bg-rose-100 text-rose-600 border-rose-200';
            case 'returned': return 'bg-slate-100 text-slate-600 border-slate-200';
            default: return 'bg-gray-100 text-gray-600 border-gray-200';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'pending': return <Clock className="h-4 w-4" />;
            case 'confirmed': return <CheckCircle2 className="h-4 w-4" />;
            case 'packed': return <Package className="h-4 w-4" />;
            case 'ready_for_pickup': return <CheckCircle2 className="h-4 w-4" />;
            case 'out_for_delivery': return <Truck className="h-4 w-4" />;
            case 'delivered': return <CheckCircle2 className="h-4 w-4" />;
            case 'cancelled': return <XCircle className="h-4 w-4" />;
            default: return <Package className="h-4 w-4" />;
        }
    };

    const handleExport = () => {
        if (!filteredOrders.length) {
            showToast('No orders available to export', 'info');
            return;
        }

        const rows = [
            ['Order ID', 'Customer', 'Seller', 'Status', 'Amount', 'Payment', 'Created At'],
            ...filteredOrders.map((order) => [
                order.id,
                order.customer,
                order.seller,
                order.status,
                order.amount,
                order.payment,
                order.date,
            ]),
        ];

        const csv = rows
            .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `quick-orders-${status}-${Date.now()}.csv`;
        link.click();
        URL.revokeObjectURL(downloadUrl);
        showToast('Orders exported successfully', 'success');
    };

    const pageTitle = status === 'all' ? 'All Orders' : status.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        {pageTitle}
                        <div className="p-2 bg-fuchsia-100 rounded-xl">
                            <ShoppingBag className="h-5 w-5 text-fuchsia-600" />
                        </div>
                    </h1>
                    <p className="ds-description mt-1">View and manage all orders.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-5 py-3 bg-white ring-1 ring-slate-200 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <Download className="h-4 w-4 text-primary" />
                        EXPORT
                    </button>
                    <div className="h-10 w-px bg-slate-200 mx-1 hidden lg:block" />
                    <div className="relative">
                        <button
                            onClick={() => {
                                setShowDateMenu((prev) => !prev);
                                setShowFilterMenu(false);
                            }}
                            className="flex items-center gap-2 px-5 py-3 bg-white ring-1 ring-slate-200 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm"
                        >
                            <Calendar className="h-4 w-4 text-emerald-500" />
                            {dateRange}
                        </button>
                        {showDateMenu && (
                            <div className="absolute right-0 top-full mt-2 w-44 rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 p-2 z-20">
                                {DATE_RANGE_OPTIONS.map((option) => (
                                    <button
                                        key={option.id}
                                        onClick={() => {
                                            setDateRange(option.label);
                                            setDateRangeId(option.id);
                                            setShowDateMenu(false);
                                        }}
                                        className={cn(
                                            "w-full rounded-xl px-3 py-2 text-left text-xs font-bold transition-colors",
                                            dateRangeId === option.id ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-50"
                                        )}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                    <Card key={i} className="p-5 border-none shadow-sm ring-1 ring-slate-100 bg-white group hover:ring-fuchsia-200 transition-all text-left">
                        <div className="flex items-center justify-between mb-4">
                            <div className={cn("p-2 rounded-xl", `bg-${stat.color}-50`)}>
                                <stat.icon className={cn("h-5 w-5", `text-${stat.color}-600`)} />
                            </div>
                            {stat.trend && (
                                <Badge variant="success" className="bg-emerald-50 text-emerald-600 border-none font-bold text-[10px]">
                                    {stat.trend}
                                </Badge>
                            )}
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                            <h3 className="text-2xl font-black text-slate-900">{stat.value}</h3>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Orders Table Section */}
            <Card className="border-none shadow-2xl ring-1 ring-slate-100/50 bg-white rounded-xl overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative group flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-fuchsia-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by Order ID, Customer, or Shop..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-semibold outline-none focus:ring-2 focus:ring-fuchsia-500/10 transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        {isRefreshing && (
                            <div className="flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <div className="h-3.5 w-3.5 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
                                Syncing
                            </div>
                        )}
                        <button
                            onClick={() => {
                                setShowFilterMenu((prev) => !prev);
                                setShowDateMenu(false);
                            }}
                            className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition-all"
                        >
                            <Filter className="h-4 w-4" />
                        </button>
                        {showFilterMenu && (
                            <div className="absolute right-6 top-[88px] w-52 rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 p-2 z-20">
                                {PAYMENT_FILTER_OPTIONS.map((option) => (
                                    <button
                                        key={option.id}
                                        onClick={() => {
                                            setPaymentFilter(option.id);
                                            setShowFilterMenu(false);
                                        }}
                                        className={cn(
                                            "w-full rounded-xl px-3 py-2 text-left text-xs font-bold transition-colors",
                                            paymentFilter === option.id ? "bg-fuchsia-50 text-fuchsia-700" : "text-slate-600 hover:bg-slate-50"
                                        )}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Order Details</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Seller</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="6" className="px-4 py-20 text-center">
                                        <div className="flex justify-center flex-col items-center gap-2">
                                            <div className="h-8 w-8 border-4 border-fuchsia-600 border-t-transparent rounded-full animate-spin"></div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Orders...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredOrders.length > 0 ? filteredOrders.map((order) => (
                                <tr
                                    key={order.id}
                                    className="group hover:bg-slate-50/30 transition-all cursor-pointer"
                                    onClick={() => navigate(`/ecs/quick-commerce/orders/view/${order.id}`)}
                                >
                                    <td className="px-4 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-white group-hover:shadow-sm transition-all text-slate-400 group-hover:text-fuchsia-500 font-bold text-xs">
                                                <Package className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                                    #{order.id}
                                                    <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-all text-slate-400" />
                                                </h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge
                                                        variant={order.orderType === 'mixed' ? 'secondary' : 'outline'}
                                                        className={cn(
                                                            "text-[9px] font-bold py-0.5 uppercase",
                                                            order.orderType === 'mixed'
                                                                ? "bg-orange-50 text-orange-700 border-orange-200"
                                                                : "border-slate-200 text-slate-400"
                                                        )}
                                                    >
                                                        {order.orderType}
                                                    </Badge>
                                                    <Badge variant="outline" className="text-[9px] font-bold border-slate-200 text-slate-400 py-0.5">
                                                        {order.items} {order.items > 1 ? 'Items' : 'Item'}
                                                    </Badge>
                                                    <span className="text-[10px] font-bold text-slate-300">•</span>
                                                    <span className="text-[10px] font-bold text-slate-400">{order.date}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-5">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-primary" />
                                            <span className="text-xs font-black text-slate-700">{order.customer}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-5">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                            <span className="text-xs font-black text-slate-700">{order.seller}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-5">
                                        <div className={cn(
                                            "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wider shadow-sm",
                                            getStatusStyles(order.status)
                                        )}>
                                            {getStatusIcon(order.status)}
                                            <span>{order.status.replace(/_/g, ' ')}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-5 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-sm font-black text-slate-900">₹{order.amount.toLocaleString()}</span>
                                            <span className="text-[10px] font-bold text-slate-400 mt-0.5">{order.payment}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-5 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/ecs/quick-commerce/orders/view/${order.id}`);
                                                }}
                                                className="p-2.5 bg-slate-50 text-slate-400 hover:text-fuchsia-600 hover:bg-fuchsia-50 rounded-xl transition-all"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteOrder(order);
                                                }}
                                                className="p-2.5 bg-rose-50 text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded-xl transition-all"
                                                title="Delete Order"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                            {(() => {
                                                const isCancelled = order.rawStatus === 'cancelled_by_user' || order.rawStatus === 'cancelled_by_restaurant' || order.rawStatus === 'cancelled_by_admin';
                                                const isOnlineOrWallet = ['razorpay', 'razorpay_qr', 'online', 'wallet'].includes(order.paymentMethod);
                                                return isCancelled && isOnlineOrWallet;
                                            })() && (
                                                <>
                                                    {order.refundStatus === 'processed' || order.refundStatus === 'initiated' ? (
                                                        <span className={cn(
                                                            "px-2 py-1.5 rounded-lg text-[10px] font-bold text-center border",
                                                            order.paymentMethod === "wallet" ? "bg-orange-50 text-orange-600 border-orange-200" : "bg-emerald-50 text-emerald-600 border-emerald-200"
                                                        )}>
                                                            {order.paymentMethod === "wallet" ? "Wallet Refunded" : "Refunded"}
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRefundClick(order);
                                                            }}
                                                            className={cn(
                                                                "px-2.5 py-2.5 text-white rounded-xl text-[10px] font-bold transition-all shadow-sm flex items-center gap-1",
                                                                order.paymentMethod === "wallet" ? "bg-orange-500 hover:bg-orange-600" : "bg-fuchsia-600 hover:bg-fuchsia-700"
                                                            )}
                                                            title="Process Refund"
                                                        >
                                                            <IndianRupee className="h-3 w-3" /> Refund
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="6" className="px-4 py-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center">
                                                <Search className="h-10 w-10 text-slate-200" />
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-black text-slate-300 uppercase tracking-tight">No Orders Found</h4>
                                                <p className="text-sm font-bold text-slate-300 mt-1">We couldn't find any orders matching your search.</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-slate-50">
                    <Pagination
                        page={page}
                        totalPages={Math.ceil(total / pageSize) || 1}
                        total={total}
                        pageSize={pageSize}
                        onPageChange={(p) => fetchOrders(p)}
                        onPageSizeChange={(newSize) => {
                            setPageSize(newSize);
                            setPage(1);
                        }}
                        loading={isLoading}
                    />
                </div>
            </Card>
            
            <RefundModal
                isOpen={refundModalOpen}
                onOpenChange={setRefundModalOpen}
                order={selectedOrderForRefund}
                isProcessing={processingRefund}
                onConfirm={(amount, refundToMethod) => {
                    if (selectedOrderForRefund) {
                        processRefund(selectedOrderForRefund.id || selectedOrderForRefund._id, amount, refundToMethod);
                    }
                }}
            />
        </div>
    );
};

export default OrdersList;
