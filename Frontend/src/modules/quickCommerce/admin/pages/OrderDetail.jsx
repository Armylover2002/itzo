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
        case 'confirmed': return 'bg-[#f0e7f9] text-[#460d8b] border-[#d8c4f1]';
        case 'packed': return 'bg-[#f0e7f9] text-[#460d8b] border-[#d8c4f1]';
        case 'ready_for_pickup': return 'bg-[#f0e7f9] text-[#460d8b] border-[#d8c4f1]';
        case 'out_for_delivery': return 'bg-[#f0e7f9] text-[#460d8b] border-[#d8c4f1]';
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
    const orderDisplayId = order?.orderId || order?.orderNumber || order?.id || orderId || 'NA';
    const orderItems = Array.isArray(order?.items) ? order.items : [];
    const customerAddress = order?.address || {};
    const customerLocation = customerAddress?.location || {};
    const deliveryBoy = order?.deliveryBoy || null;

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

    const handlePrintInvoice = () => {
        if (!order) return;
        const invoiceWindow = window.open('', '_blank', 'width=900,height=700');
        if (!invoiceWindow) {
            showToast('Unable to open print window', 'error');
            return;
        }

        const payableTotal = Math.max(
            0,
            Number(order?.pricing?.total || 0) + Number(order?.pricing?.platformFee || 0),
        );

        const itemsHtml = orderItems.map((item) => {
            const quantity = Number(item.quantity || 0);
            const unitPrice = Number(item.price || 0);
            return `
                <tr>
                    <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${item.name || 'Item'}</td>
                    <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center;">${quantity}</td>
                    <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatCurrency(unitPrice)}</td>
                    <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatCurrency(quantity * unitPrice)}</td>
                </tr>
            `;
        }).join('');

        invoiceWindow.document.write(`
            <html>
                <head><title>Invoice ${orderDisplayId}</title></head>
                <body style="font-family:Arial,sans-serif;padding:24px;color:#0f172a;">
                    <h1 style="margin-bottom:4px;">Quick Order Invoice</h1>
                    <p style="margin-top:0;color:#475569;">Order ID: ${orderDisplayId}</p>
                    <p>Date: ${formatDateTime(order.createdAt)}</p>
                    <h3>Customer</h3>
                    <p>${order.customer?.name || 'Unknown'}<br/>${order.customer?.phone || 'NA'}</p>
                    <h3>Items</h3>
                    <table style="width:100%;border-collapse:collapse;">
                        <thead>
                            <tr>
                                <th style="padding:8px;text-align:left;border-bottom:2px solid #cbd5e1;">Item</th>
                                <th style="padding:8px;text-align:center;border-bottom:2px solid #cbd5e1;">Qty</th>
                                <th style="padding:8px;text-align:right;border-bottom:2px solid #cbd5e1;">Unit</th>
                                <th style="padding:8px;text-align:right;border-bottom:2px solid #cbd5e1;">Total</th>
                            </tr>
                        </thead>
                        <tbody>${itemsHtml}</tbody>
                    </table>
                    <h3 style="margin-top:24px;">Summary</h3>
                    <p>Subtotal: ${formatCurrency(order.pricing?.subtotal)}</p>
                    <p>Delivery Fee: ${formatCurrency(order.pricing?.deliveryFee)}</p>
                    <p>Platform Fee: ${formatCurrency(order.pricing?.platformFee)}</p>
                    <p><strong>Total: ${formatCurrency(payableTotal)}</strong></p>
                </body>
            </html>
        `);
        invoiceWindow.document.close();
        invoiceWindow.focus();
        invoiceWindow.print();
    };

    if (isLoading) {
        return (
            <div className="min-h-[400px] flex flex-col items-center justify-center gap-4">
                <div className="h-12 w-12 border-4 border-[#6412c6] border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-[4px]">Accessing Intelligence...</p>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-[400px] flex flex-col items-center justify-center gap-4 text-center p-8">
                <AlertCircle className="h-16 w-16 text-rose-200" />
                <h2 className="text-xl font-black text-slate-900 uppercase">Order Node Not Found</h2>
                <button onClick={() => navigate(-1)} className="ds-btn ds-btn-md bg-slate-900 text-white mt-4">Return to List</button>
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
                    <button onClick={handleExportIntelligence} className="flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-xl active:scale-95">
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
                                <Box className="h-4 w-4 text-primary" />
                                Items in Order
                            </h3>
                            <Badge className="bg-[#f7f3fc] text-[#460d8b] border-none text-[9px] font-black">{orderItems.length} ITEMS</Badge>
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
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">ID: {item.productId || item.product?._id || 'NA'}</p>
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
                            <div className="flex items-center justify-between w-full max-w-[240px]">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subtotal</span>
                                <span className="text-sm font-black text-slate-700">{formatCurrency(order.pricing?.subtotal)}</span>
                            </div>
                            <div className="flex items-center justify-between w-full max-w-[240px]">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery Fee</span>
                                <span className="text-sm font-bold text-emerald-600">{formatCurrency(order.pricing?.deliveryFee)}</span>
                            </div>
                            <div className="flex items-center justify-between w-full max-w-[240px]">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Platform Fee</span>
                                <span className="text-sm font-bold text-slate-700">{formatCurrency(order.pricing?.platformFee)}</span>
                            </div>
                            <div className="h-px w-full max-w-[240px] bg-slate-200 my-2" />
                            <div className="flex items-center justify-between w-full max-w-[240px]">
                                <span className="text-xs font-black text-slate-900 uppercase tracking-tight">Total Payable</span>
                                <span className="text-2xl font-black text-[#6412c6]">{formatCurrency(Number(order.pricing?.total || 0) + Number(order.pricing?.platformFee || 0))}</span>
                            </div>
                        </div>
                    </Card>

                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-2xl p-6">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Store className="h-4 w-4" />
                            Shop Node Information
                        </h4>
                        <div className="flex items-center gap-4">
                            <div className="h-16 w-16 bg-[#f7f3fc] rounded-2xl flex items-center justify-center font-black text-[#550fa8] uppercase">
                                {order.seller?.shopName?.[0] || 'S'}
                            </div>
                            <div className="text-left">
                                <h3 className="text-lg font-black text-slate-900 leading-tight">{order.seller?.shopName || 'Unknown Shop'}</h3>
                                <p className="text-xs font-bold text-emerald-600 uppercase tracking-tighter">Verified Anchor Partner</p>
                                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Owner: {order.seller?.name || 'NA'}</p>
                            </div>
                        </div>
                    </Card>

                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl p-6">
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-3">
                            <Navigation className="h-4 w-4 text-emerald-500" />
                            Logistical Real-time State
                        </h3>
                        <div className="space-y-6 relative ml-4">
                            <div className="absolute top-0 bottom-0 left-[7.5px] w-0.5 bg-slate-100" />
                            <div className="flex gap-6 relative">
                                <div className="h-4 w-4 rounded-full ring-4 ring-white z-10 mt-1 bg-emerald-500 shadow-lg shadow-emerald-200" />
                                <div className="flex-1 pb-4">
                                    <div className="flex items-center justify-between mb-1">
                                        <h4 className="text-xs font-black uppercase tracking-tight text-slate-900">
                                            Status: {currentStatus.replace(/_/g, ' ')}
                                        </h4>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{formatDateTime(order.updatedAt)}</span>
                                    </div>
                                    <p className="text-[11px] font-bold text-slate-400 leading-relaxed italic">System verified current logistical state as {currentStatus}.</p>
                                </div>
                            </div>
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
                            <div className="h-16 w-16 bg-[#f7f3fc] rounded-2xl flex items-center justify-center font-black text-primary uppercase">
                                {order.customer?.name?.split(' ').map((name) => name[0]).join('') || 'C'}
                            </div>
                            <div className="text-left">
                                <h3 className="text-lg font-black text-slate-900 leading-tight">{order.customer?.name || 'Unknown'}</h3>
                                <p className="text-xs font-bold text-slate-400">Node ID: {order.customer?._id || order.customer?.id || 'NA'}</p>
                            </div>
                        </div>
                        <div className="space-y-6 text-left mt-6">
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-3">
                                    <Mail className="h-3.5 w-3.5" /> {order.customer?.email || 'NA'}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-3">
                                    <Phone className="h-3.5 w-3.5" /> {order.customer?.phone || 'NA'}
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
                                    {customerAddress?.address || 'NA'} {customerAddress?.landmark ? `, ${customerAddress.landmark}` : ''} {customerAddress?.city ? `, ${customerAddress.city}` : ''}
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
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-2xl overflow-hidden text-left">
                        <div className="p-6 bg-slate-900 text-white">
                            <h4 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-white">
                                <CreditCard className="h-4 w-4 text-emerald-400" />
                                Payment Vector
                            </h4>
                        </div>
                        <div className="p-4 space-y-6">
                            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocol Summary</span>
                                <Badge className={cn('border-none text-[8px] font-black uppercase', order.payment?.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                                    {order.payment?.status || 'PENDING'}
                                </Badge>
                            </div>
                            <div className="flex items-center justify-between px-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TXN Hash</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-700 truncate max-w-[100px]">{order.payment?.transactionId || 'N/A'}</span>
                                    <button onClick={() => copyToClipboard(order.payment?.transactionId, 'Transaction ID')} className="p-1.5 hover:bg-slate-50 rounded-md text-slate-300">
                                        <Copy className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center justify-between px-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gateway Method</span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">{order.payment?.method || 'CASH'}</span>
                            </div>
                        </div>
                    </Card>

                    <Card className="border-none shadow-xl ring-1 ring-amber-100 bg-amber-50/30 rounded-xl p-6 text-left">
                        <h4 className="text-[10px] font-black text-amber-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Info className="h-4 w-4" />
                            Intelligence Notes
                        </h4>
                        <p className="text-xs font-bold text-amber-800 leading-relaxed italic">
                            {order.cancelReason
                                ? `Cancellation Payload: ${order.cancelReason}`
                                : `Delivery window scheduled for ${order.timeSlot || 'NA'}. Instructions: Follow local logistical protocols.`}
                        </p>
                    </Card>
                </div>
            </div>
        </div>
    );
}
