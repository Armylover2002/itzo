import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import { adminApi } from '../services/adminApi';
import {
    AlertCircle,
    Box,
    Calendar,
    ChevronLeft,
    Clock,
    Copy,
    CreditCard,
    Download,
    Info,
    Mail,
    MapPin,
    Navigation,
    Package,
    Phone,
    Printer,
    Store,
    Truck,
    User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@shared/components/ui/Toast';
import { joinOrderRoom, leaveOrderRoom, onOrderStatusUpdate } from "@/core/services/orderSocket";
import { getQuickOrderMoneyBreakdown } from '../utils/orderMoneyBreakdown';
import { generateOrderInvoice } from '@food/utils/printOrderInvoice';
import { mapReturnStatusLabel } from '@/shared/utils/returnStatus';
import ReturnItemsDetailList from '@shared/components/returns/ReturnItemsDetailList';

const AUTO_REFRESH_INTERVAL_MS = 30000;

const formatDateTime = (value) => {
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

const formatCurrency = (value) =>
    `₹${Number(value || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const getStatusStyles = (status) => {
    const normalizedStatus = String(status || 'pending').trim().toLowerCase();
    switch (normalizedStatus) {
        case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'confirmed': return 'bg-blue-100 text-blue-700 border-blue-200';
        case 'packed': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
        case 'ready_for_pickup': return 'bg-blue-100 text-blue-700 border-blue-200';
        case 'out_for_delivery': return 'bg-purple-100 text-purple-700 border-purple-200';
        case 'delivered': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        case 'cancelled': return 'bg-rose-100 text-rose-700 border-rose-200';
        default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
};

const getNormalizedStatus = (order) =>
    String(
        order?.status ||
        order?.orderStatus ||
        order?.workflowStatus ||
        order?.sellerOrder?.status ||
        'pending'
    )
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');

const formatStatusLabel = (value) => {
    const status = String(value || '').trim().toLowerCase();
    if (!status) return 'Updated';
    if (status === 'created' || status === 'placed') return 'Order Placed';
    if (status === 'confirmed' || status === 'seller_accepted' || status === 'accepted') return 'Confirmed';
    if (status === 'preparing' || status === 'packed' || status === 'processing') return 'Preparing / Packed';
    if (status === 'ready_for_pickup' || status === 'ready') return 'Ready for Pickup';
    if (status === 'assigned' || status === 'rider_assigned') return 'Rider Assigned';
    if (status === 'at_pickup' || status === 'reached_pickup') return 'Rider at Pickup';
    if (status === 'picked_up' || status === 'out_for_delivery' || status === 'on_way') return 'Out for Delivery';
    if (status === 'at_drop' || status === 'reached_drop') return 'Arrived at Drop';
    if (status === 'delivered') return 'Delivered';
    if (status.includes('cancel')) return 'Cancelled';
    return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const buildOrderTimeline = (order) => {
    const history = Array.isArray(order?.statusHistory) ? order.statusHistory : [];
    if (history.length > 0) {
        return history.map((entry) => {
            const toStatus = String(entry?.to || entry?.status || entry?.state || '').trim();
            const isCancel = toStatus.toLowerCase().includes('cancel') || toStatus.toLowerCase().includes('reject');
            return {
                event: formatStatusLabel(toStatus),
                timestamp: formatDateTime(entry?.at || entry?.createdAt || entry?.timestamp),
                status: isCancel ? 'rejected' : 'completed',
                byRole: entry?.byRole || entry?.role || '',
                note: entry?.note || entry?.reason || '',
                from: entry?.from || '',
                to: toStatus,
            };
        });
    }

    const fallback = [
        {
            event: 'Order Placed',
            timestamp: formatDateTime(order?.createdAt),
            status: 'completed',
            byRole: 'SYSTEM',
            note: '',
            from: '',
            to: 'placed',
        },
    ];
    const current = getNormalizedStatus(order);
    if (current && current !== 'placed' && current !== 'created' && current !== 'pending') {
        fallback.push({
            event: formatStatusLabel(current),
            timestamp: formatDateTime(order?.updatedAt || order?.deliveredAt),
            status: current.includes('cancel') ? 'rejected' : 'completed',
            byRole: 'SYSTEM',
            note: '',
            from: 'placed',
            to: current,
        });
    }
    return fallback;
};

const formatCustomerAddressText = (address = {}) => {
    const formatted = String(address.formattedAddress || '').trim();
    if (formatted) return formatted;
    return [
        address.address || address.street,
        address.additionalDetails || address.landmark,
        address.city,
        address.state,
        address.zipCode || address.pincode,
    ]
        .map((part) => String(part || '').trim())
        .filter(Boolean)
        .join(', ') || 'NA';
};

export default function OrderDetail() {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [order, setOrder] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const getToken = () =>
        localStorage.getItem("admin_accessToken") ||
        localStorage.getItem("accessToken") ||
        "";

    const fetchDetail = async () => {
        if (!orderId) return;
        setIsLoading(true);
        try {
            const response = await adminApi.getOrderDetails(orderId);
            if (response.data?.success) {
                setOrder(response.data.result || null);
            } else {
                setOrder(null);
            }
        } catch (error) {
            console.error('Failed to load quick order detail:', error);
            setOrder(null);
            showToast('Failed to load order details', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDetail();
    }, [orderId]);

    useEffect(() => {
        if (!orderId) return undefined;
        joinOrderRoom(orderId, getToken);
        const off = onOrderStatusUpdate(getToken, (payload) => {
            const id = String(payload?.orderId || "").trim();
            if (!id || String(orderId) !== id) return;
            setOrder((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    orderStatus: payload?.orderStatus ?? prev.orderStatus,
                    status: payload?.sellerStatus ?? prev.status,
                };
            });
        });

        return () => {
            off?.();
            leaveOrderRoom(orderId, getToken);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderId]);

    useEffect(() => {
        if (!orderId) return undefined;
        const interval = window.setInterval(fetchDetail, AUTO_REFRESH_INTERVAL_MS);
        return () => window.clearInterval(interval);
    }, [orderId]);

    const currentStatus = useMemo(() => getNormalizedStatus(order), [order]);
    const timeline = useMemo(() => (order ? buildOrderTimeline(order) : []), [order]);
    const cancellationReason = useMemo(() => {
        const direct = String(order?.cancellationReason || order?.sellerOrder?.cancellationReason || '').trim();
        if (direct) return direct;

        const history = Array.isArray(order?.statusHistory) ? order.statusHistory : [];
        const cancelEntry = [...history]
            .reverse()
            .find((entry) => String(entry?.to || '').toLowerCase().includes('cancel'));
        return String(cancelEntry?.note || order?.payment?.refund?.reason || '').trim();
    }, [order]);
    const orderDisplayId = order?.orderId || order?.orderNumber || order?.id || orderId || 'NA';
    const orderItems = Array.isArray(order?.items) ? order.items : [];
    const resolveItemVariant = (item) =>
        String(item?.variantName || item?.notes || "").trim();
    const customerAddress = order?.address || {};
    const customerLocation = customerAddress?.location || {};
    const deliveryBoy = order?.deliveryBoy || order?.deliveryPartner || null;
    const paymentStatus = String(order?.payment?.status || '').toLowerCase();
    const paymentCompleted =
        paymentStatus === 'completed' ||
        paymentStatus === 'paid' ||
        paymentStatus === 'captured' ||
        paymentStatus === 'success';
    const customerAddressText = formatCustomerAddressText(customerAddress);

    const copyToClipboard = async (text, label) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(String(text));
            showToast(`${label} copied`, 'success');
        } catch {
            showToast(`Failed to copy ${label.toLowerCase()}`, 'error');
        }
    };

    const handleExportIntelligence = () => {
        if (!order) return;
        const blob = new Blob([JSON.stringify(order, null, 2)], { type: 'application/json;charset=utf-8' });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `quick-order-${orderDisplayId}.json`;
        link.click();
        URL.revokeObjectURL(downloadUrl);
        showToast('Order intelligence exported', 'success');
    };

    const handlePrintInvoice = async () => {
        if (!order) return;
        try {
            await generateOrderInvoice(
                {
                    ...order,
                    orderType: 'quick',
                    orderId: orderDisplayId,
                    storeName: order.seller?.shopName || order.storeName,
                    sellerName: order.seller?.shopName || order.seller?.name,
                    customerName: order.customer?.name,
                    customerPhone: order.customer?.phone,
                    payment: order.payment,
                    returnSummary: order.returnSummary || null,
                    originalPaidTotal: order.originalPaidTotal,
                    refundedAmount: order.refundedAmount,
                    netAfterReturn: order.netAfterReturn,
                    returnStatus: order.returnStatus,
                    returnStatusLabel: order.returnStatusLabel,
                },
                { audience: 'customer' },
            );
            showToast('Invoice downloaded', 'success');
        } catch (error) {
            console.error('Invoice print failed:', error);
            showToast('Unable to generate invoice', 'error');
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-[400px] flex flex-col items-center justify-center gap-4">
                <div className="h-12 w-12 border-4 border-fuchsia-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-[4px]">Accessing Intelligence...</p>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-[400px] flex flex-col items-center justify-center gap-4 text-center p-8">
                <AlertCircle className="h-16 w-16 text-rose-200" />
                <h2 className="text-xl font-black text-slate-900 uppercase">Order Node Not Found</h2>
                <button onClick={() => navigate(-1)} className="ds-btn ds-btn-md bg-red-600 text-white mt-4">Return to List</button>
            </div>
        );
    }

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-3 bg-white ring-1 ring-slate-200 rounded-2xl hover:bg-slate-50 transition-all text-slate-400 group"
                    >
                        <ChevronLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Order #{orderDisplayId}</h1>
                            <div className={cn(
                                "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest shadow-sm",
                                getStatusStyles(currentStatus)
                            )}>
                                <Info className="h-3.5 w-3.5" />
                                {currentStatus.replace(/_/g, ' ')}
                            </div>
                            {(order.hasReturn || order.returnStatus) ? (
                                <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-amber-700 shadow-sm">
                                    {order.returnStatusLabel || mapReturnStatusLabel(order.returnStatus) || 'Return'}
                                </div>
                            ) : null}
                        </div>
                        <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-widest flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDateTime(order.createdAt)}
                            <Clock className="h-3.5 w-3.5 ml-1" />
                            Updated {formatDateTime(order.updatedAt)}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handlePrintInvoice} className="flex items-center gap-2 px-5 py-3 bg-white ring-1 ring-slate-200 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
                        <Printer className="h-4 w-4 text-slate-400" />
                        Print Invoice
                    </button>
                    <button onClick={handleExportIntelligence} className="flex items-center gap-2 px-5 py-3 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-xl active:scale-95">
                        <Download className="h-4 w-4 text-emerald-400" />
                        Export Intelligence
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
                        <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                <Box className="h-4 w-4 text-indigo-500" />
                                Items in Order
                            </h3>
                            <Badge className="bg-indigo-50 text-indigo-700 border-none text-[9px] font-black">{orderItems.length} ITEMS</Badge>
                        </div>
                        <div className="p-0 overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50">
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product Node</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Unit Price</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Qty</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Aggregate</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {orderItems.map((item, index) => (
                                        <tr key={item._id || item.productId || index} className="group hover:bg-slate-50/30 transition-all">
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-14 w-14 bg-slate-50 rounded-2xl flex items-center justify-center shadow-inner border border-slate-100 group-hover:scale-110 transition-transform overflow-hidden">
                                                        {item.image ? (
                                                            <img src={item.image} alt={item.name || 'Item'} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Package className="h-6 w-6 text-slate-200" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-black text-slate-900">{item.name || 'Item'}</h4>
                                                        {resolveItemVariant(item) ? (
                                                            <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest mt-1">
                                                                {resolveItemVariant(item)}
                                                            </p>
                                                        ) : null}
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">ID: {item.productId || item.itemId || item.product?._id || 'NA'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-center text-sm font-bold text-slate-600">{formatCurrency(item.price)}</td>
                                            <td className="px-6 py-5 text-center">
                                                <span className="bg-slate-100 px-3 py-1 rounded-lg text-xs font-black text-slate-700">x{item.quantity || 0}</span>
                                            </td>
                                            <td className="px-6 py-5 text-right text-sm font-black text-slate-900">{formatCurrency(Number(item.price || 0) * Number(item.quantity || 0))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 bg-slate-50/50 flex flex-col items-end gap-3 text-right">
                            {(() => {
                                const money = getQuickOrderMoneyBreakdown(order);
                                return (
                                    <>
                            <div className="flex items-center justify-between w-full max-w-[280px]">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subtotal</span>
                                <span className="text-sm font-black text-slate-700">{formatCurrency(money.subtotal)}</span>
                            </div>
                            {money.discount > 0 && (
                                <div className="flex items-center justify-between w-full max-w-[280px]">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Coupon ({money.couponSource === 'admin' ? 'Admin' : money.couponSource ? 'Seller' : 'Discount'})
                                    </span>
                                    <span className="text-sm font-bold text-rose-600">
                                        -{formatCurrency(money.discount)}
                                    </span>
                                </div>
                            )}
                            <div className="flex items-center justify-between w-full max-w-[280px]">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery Fee</span>
                                <span className="text-sm font-bold text-emerald-600">{formatCurrency(money.deliveryFee)}</span>
                            </div>
                            <div className="flex items-center justify-between w-full max-w-[280px]">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Platform Fee</span>
                                <span className="text-sm font-bold text-slate-700">{formatCurrency(money.platformFee)}</span>
                            </div>
                            {money.packingFee > 0 && (
                                <div className="flex items-center justify-between w-full max-w-[280px]">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Packing Fee (Seller)</span>
                                    <span className="text-sm font-bold text-slate-700">{formatCurrency(money.packingFee)}</span>
                                </div>
                            )}
                            {money.returnPickupFee > 0 && (
                                <div className="flex items-center justify-between w-full max-w-[280px]">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Return Pickup (Seller, historical)</span>
                                    <span className="text-sm font-bold text-rose-600">-{formatCurrency(money.returnPickupFee)}</span>
                                </div>
                            )}
                            {money.returnPickupPaidByAdmin > 0 && (
                                <div className="flex items-center justify-between w-full max-w-[280px]">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Return Delivery Charge (Admin)</span>
                                    <span className="text-sm font-bold text-rose-600">-{formatCurrency(money.returnPickupPaidByAdmin)}</span>
                                </div>
                            )}
                            <div className="flex items-center justify-between w-full max-w-[280px]">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">GST / Tax</span>
                                <span className="text-sm font-bold text-slate-700">{formatCurrency(money.tax)}</span>
                            </div>
                            <div className="h-px w-full max-w-[280px] bg-slate-200 my-1" />
                            <div className="flex items-center justify-between w-full max-w-[280px]">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Seller Commission</span>
                                <span className="text-sm font-bold text-indigo-600">{formatCurrency(money.commission)}</span>
                            </div>
                            <div className="flex items-center justify-between w-full max-w-[280px]">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Seller Receivable</span>
                                <span className={cn(
                                    "text-sm font-bold",
                                    money.sellerEarned < 0 ? "text-rose-600" : "text-emerald-600",
                                )}>
                                    {formatCurrency(money.sellerEarned)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between w-full max-w-[280px]">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery Rider</span>
                                <span className="text-sm font-bold text-orange-600">{formatCurrency(money.deliveryRiderEarning)}</span>
                            </div>
                            {money.returnRiderEarning > 0 && (
                                <div className="flex items-center justify-between w-full max-w-[280px]">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Return Rider</span>
                                    <span className="text-sm font-bold text-orange-600">{formatCurrency(money.returnRiderEarning)}</span>
                                </div>
                            )}
                            <div className="flex items-center justify-between w-full max-w-[280px]">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rider Earning (Total)</span>
                                <span className="text-sm font-bold text-orange-600">{formatCurrency(money.riderEarned)}</span>
                            </div>
                            <div className="flex items-center justify-between w-full max-w-[280px]">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery Margin</span>
                                <span className={cn(
                                    "text-sm font-bold",
                                    money.deliveryMargin < 0 ? "text-rose-600" : "text-slate-700",
                                )}>
                                    {formatCurrency(money.deliveryMargin)}
                                </span>
                            </div>
                            {money.adminDiscount > 0 && (
                                <div className="flex items-center justify-between w-full max-w-[280px]">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Admin Coupon Cost</span>
                                    <span className="text-sm font-bold text-rose-600">-{formatCurrency(money.adminDiscount)}</span>
                                </div>
                            )}
                            {money.returnPickupPaidByAdmin > 0 && (
                                <div className="flex items-center justify-between w-full max-w-[280px]">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Admin Earning Before Return Charge</span>
                                    <span className="text-sm font-bold text-purple-500">
                                        {formatCurrency(money.adminEarningBeforePickup)}
                                    </span>
                                </div>
                            )}
                            <div className="flex items-center justify-between w-full max-w-[280px]">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Admin Earning</span>
                                <span className={cn(
                                    "text-sm font-bold",
                                    money.adminEarned < 0 ? "text-rose-600" : "text-purple-600",
                                )}>
                                    {formatCurrency(money.adminEarned)}
                                </span>
                            </div>
                            <p className="w-full max-w-[280px] text-[9px] text-slate-400 text-left leading-relaxed">
                                Admin = Platform fee + GST + Commission + (Delivery fee − Rider) − Admin coupon − return delivery charge. Packing goes to seller.
                            </p>
                            <div className="h-px w-full max-w-[280px] bg-slate-200 my-2" />
                            <div className="flex items-center justify-between w-full max-w-[280px]">
                                <span className="text-xs font-black text-slate-900 uppercase tracking-tight">Total Payable</span>
                                <span className="text-2xl font-black text-fuchsia-600">{formatCurrency(money.userPaid || order.pricing?.total)}</span>
                            </div>
                            {(order.hasReturn || Number(order.refundedAmount || 0) > 0) ? (
                                <>
                                    <div className="h-px w-full max-w-[280px] bg-amber-200 my-2" />
                                    <div className="flex items-center justify-between w-full max-w-[280px]">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Original paid</span>
                                        <span className="text-sm font-bold text-slate-700">
                                            {formatCurrency(order.originalPaidTotal || money.userPaid || order.pricing?.total)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between w-full max-w-[280px]">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Refunded</span>
                                        <span className="text-sm font-bold text-rose-600">
                                            -{formatCurrency(order.refundedAmount || 0)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between w-full max-w-[280px]">
                                        <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Net after return</span>
                                        <span className="text-lg font-black text-amber-700">
                                            {formatCurrency(order.netAfterReturn ?? Math.max(0, Number(order.originalPaidTotal || money.userPaid || 0) - Number(order.refundedAmount || 0)))}
                                        </span>
                                    </div>
                                </>
                            ) : null}
                                    </>
                                );
                            })()}
                        </div>
                    </Card>

                    {(order.hasReturn || order.returnSummary?.hasReturn) ? (
                        <Card className="border-none shadow-xl ring-1 ring-amber-100 bg-white rounded-xl overflow-hidden">
                            <div className="p-6 border-b border-amber-50 bg-amber-50/40 flex items-center justify-between">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                    <Truck className="h-4 w-4 text-amber-600" />
                                    Return & Refund
                                </h3>
                                <Badge className="bg-amber-100 text-amber-800 border-none text-[9px] font-black uppercase">
                                    {order.returnStatusLabel || mapReturnStatusLabel(order.returnStatus) || 'Return'}
                                </Badge>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="rounded-xl bg-slate-50 p-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Original</p>
                                        <p className="text-sm font-black text-slate-900 mt-1">{formatCurrency(order.originalPaidTotal || order.pricing?.total)}</p>
                                    </div>
                                    <div className="rounded-xl bg-rose-50 p-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-rose-400">Refunded</p>
                                        <p className="text-sm font-black text-rose-700 mt-1">{formatCurrency(order.refundedAmount || 0)}</p>
                                    </div>
                                    <div className="rounded-xl bg-emerald-50 p-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Net</p>
                                        <p className="text-sm font-black text-emerald-700 mt-1">{formatCurrency(order.netAfterReturn ?? order.pricing?.total)}</p>
                                    </div>
                                </div>
                                {(Array.isArray(order.returnSummary?.returns) ? order.returnSummary.returns : []).map((ret) => (
                                    <div key={ret.returnId} className="rounded-xl border border-slate-100 p-4 space-y-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-xs font-black uppercase tracking-widest text-slate-700">
                                                {ret.returnStatusLabel || mapReturnStatusLabel(ret.returnStatus)}
                                            </p>
                                            <p className="text-xs font-bold text-slate-500">
                                                Refund {formatCurrency(ret.returnRefundAmount || ret.pricing?.finalRefundAmount)}
                                            </p>
                                        </div>
                                        {Array.isArray(ret.returnItems) && ret.returnItems.length > 0 ? (
                                            <ReturnItemsDetailList
                                                items={ret.returnItems}
                                                variant="compact"
                                                className="mt-2"
                                            />
                                        ) : null}
                                        {(Array.isArray(ret.returnHistory) ? ret.returnHistory : []).slice(-6).map((entry, idx) => (
                                            <div key={`${ret.returnId}-hist-${idx}`} className="flex items-start justify-between gap-3 text-[11px]">
                                                <div>
                                                    <p className="font-bold text-slate-700">{String(entry.action || entry.toStatus || '').replace(/_/g, ' ')}</p>
                                                    {entry.note ? <p className="text-slate-400">{entry.note}</p> : null}
                                                </div>
                                                <span className="text-slate-400 whitespace-nowrap">
                                                    {formatDateTime(entry.at || entry.createdAt)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </Card>
                    ) : null}

                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-2xl p-6">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Store className="h-4 w-4" />
                            Shop Node Information
                        </h4>
                        <div className="flex items-center gap-4">
                            <div className="h-16 w-16 bg-red-50 rounded-2xl flex items-center justify-center font-black text-slate-900 uppercase">
                                {(order.seller?.shopName || order.storeName || 'S').charAt(0)}
                            </div>
                            <div className="text-left">
                                <h3 className="text-lg font-black text-slate-900 leading-tight">
                                    {order.seller?.shopName || order.storeName || 'Unknown Shop'}
                                </h3>
                                <p className="text-xs font-bold text-emerald-600 uppercase tracking-tighter">
                                    {order.seller?.businessType || 'Verified Anchor Partner'}
                                </p>
                                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                                    Owner: {order.seller?.name || 'NA'}
                                </p>
                                <p className="text-[10px] font-bold text-slate-500 mt-1">
                                    Phone: {order.seller?.phone || 'NA'}
                                </p>
                                {order.seller?.address ? (
                                    <p className="text-[10px] font-medium text-slate-500 mt-1 leading-relaxed">
                                        {order.seller.address}
                                    </p>
                                ) : null}
                            </div>
                        </div>
                    </Card>

                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl p-6">
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-3">
                            <Navigation className="h-4 w-4 text-emerald-500" />
                            Order Status History
                        </h3>
                        {currentStatus.includes('cancel') && cancellationReason ? (
                            <div className="mb-6 rounded-2xl border border-rose-100 bg-rose-50 p-4">
                                <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-2">
                                    Cancellation Reason
                                </p>
                                <p className="text-sm font-semibold text-slate-700 leading-relaxed">
                                    {cancellationReason}
                                </p>
                            </div>
                        ) : null}
                        <div className="space-y-6 relative ml-4">
                            <div className="absolute top-0 bottom-0 left-[7.5px] w-0.5 bg-slate-100" />
                            {timeline.map((event, index) => (
                                <div key={`${event.to}-${index}`} className="flex gap-6 relative">
                                    <div className={cn(
                                        "h-4 w-4 rounded-full ring-4 ring-white z-10 mt-1 shadow-lg",
                                        event.status === 'rejected'
                                            ? "bg-rose-500 shadow-rose-200"
                                            : "bg-emerald-500 shadow-emerald-200",
                                    )} />
                                    <div className="flex-1 pb-4">
                                        <div className="flex items-center justify-between mb-1 gap-3">
                                            <h4 className="text-xs font-black uppercase tracking-tight text-slate-900">
                                                {event.event}
                                            </h4>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">
                                                {event.timestamp}
                                            </span>
                                        </div>
                                        {(event.byRole || event.note) && (
                                            <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
                                                {event.byRole ? `${event.byRole}` : ''}
                                                {event.byRole && event.note ? ' • ' : ''}
                                                {event.note || ''}
                                            </p>
                                        )}
                                        {event.from && event.to && event.from !== event.to ? (
                                            <p className="text-[10px] font-medium text-slate-400 mt-1">
                                                From {formatStatusLabel(event.from)} to {formatStatusLabel(event.to)}
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-2xl p-6">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Customer Node Information
                        </h4>
                        <div className="flex items-center gap-4">
                            <div className="h-16 w-16 bg-indigo-50 rounded-2xl flex items-center justify-center font-black text-indigo-600 uppercase">
                                {(order.customer?.name || 'C')
                                    .split(' ')
                                    .filter(Boolean)
                                    .map((name) => name[0])
                                    .join('')
                                    .slice(0, 2) || 'C'}
                            </div>
                            <div className="text-left">
                                <h3 className="text-lg font-black text-slate-900 leading-tight">{order.customer?.name || 'Unknown'}</h3>
                                <p className="text-xs font-bold text-slate-400">
                                    Node ID: {order.customer?._id || order.customer?.id || 'NA'}
                                </p>
                            </div>
                        </div>
                        <div className="space-y-6 text-left mt-6">
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-3">
                                    <Mail className="h-3.5 w-3.5" /> {order.customer?.email || 'NA'}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-3">
                                    <Phone className="h-3.5 w-3.5" /> {order.customer?.phone || customerAddress?.phone || 'NA'}
                                </span>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Destination Protocol</span>
                                    {customerLocation &&
                                        typeof customerLocation.lat === 'number' &&
                                        typeof customerLocation.lng === 'number' && (
                                            <button
                                                type="button"
                                                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${customerLocation.lat},${customerLocation.lng}`, '_blank')}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-primary hover:bg-primary/5 transition-colors"
                                            >
                                                <MapPin className="h-3 w-3" />
                                                Open in Maps
                                            </button>
                                        )}
                                </div>
                                <p className="text-xs font-bold text-slate-600 leading-relaxed italic">
                                    {customerAddressText}
                                </p>
                            </div>
                        </div>
                    </Card>

                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl p-6 text-left">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Truck className="h-3.5 w-3.5" /> Logistical Agent
                                </h4>
                                <Badge variant={deliveryBoy ? 'success' : 'secondary'} className="text-[8px] font-black uppercase tracking-widest">
                                    {deliveryBoy ? 'ASSIGNED' : 'UNASSIGNED'}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                                <div className="h-10 w-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-300 overflow-hidden">
                                    {deliveryBoy ? (
                                        <div className="h-full w-full flex items-center justify-center font-black text-slate-400 bg-emerald-50">{String(deliveryBoy?.name || 'R').charAt(0)}</div>
                                    ) : (
                                        <User className="h-5 w-5" />
                                    )}
                                </div>
                                <div>
                                    <h5 className="text-sm font-black text-slate-900">{deliveryBoy?.name || 'Pending Rider Assignment'}</h5>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Contact: {deliveryBoy?.phone || 'N/A'}</p>
                                    {(deliveryBoy?.vehicleType || deliveryBoy?.vehicleNumber) && (
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                            {[deliveryBoy.vehicleType, deliveryBoy.vehicleNumber].filter(Boolean).join(' • ')}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-2xl overflow-hidden text-left">
                        <div className="p-6 bg-red-600 text-white">
                            <h4 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-white">
                                <CreditCard className="h-4 w-4 text-emerald-400" />
                                Payment Vector
                            </h4>
                        </div>
                        <div className="p-4 space-y-6">
                            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocol Summary</span>
                                <Badge className={cn('border-none text-[8px] font-black uppercase', paymentCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                                    {order.payment?.status || 'PENDING'}
                                </Badge>
                            </div>
                            <div className="flex items-center justify-between px-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TXN Hash</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-700 truncate max-w-[100px]">{order.payment?.transactionId || 'N/A'}</span>
                                    {order.payment?.transactionId ? (
                                        <button onClick={() => copyToClipboard(order.payment?.transactionId, 'Transaction ID')} className="p-1.5 hover:bg-slate-50 rounded-md text-slate-300">
                                            <Copy className="h-3 w-3" />
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                            <div className="flex items-center justify-between px-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gateway Method</span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">{order.payment?.method || 'CASH'}</span>
                            </div>
                            <div className="flex items-center justify-between px-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</span>
                                <span className="text-[10px] font-black tracking-widest text-slate-900">
                                    {formatCurrency(order.payment?.amountPaid || order.pricing?.total || order.amount)}
                                </span>
                            </div>
                        </div>
                    </Card>

                    <Card className="border-none shadow-xl ring-1 ring-amber-100 bg-amber-50/30 rounded-xl p-6 text-left">
                        <h4 className="text-[10px] font-black text-amber-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Info className="h-4 w-4" />
                            Intelligence Notes
                        </h4>
                        <p className="text-xs font-bold text-amber-800 leading-relaxed italic">
                            {cancellationReason
                                ? `Cancellation Payload: ${cancellationReason}`
                                : order.note
                                    ? `Customer note: ${order.note}`
                                    : `Delivery window scheduled for ${order.timeSlot || 'now'}. Instructions: Follow local logistical protocols.`}
                        </p>
                    </Card>
                </div>
            </div>
        </div>
    );
}
