import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi } from '../services/adminApi';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import {
    Mail,
    Phone,
    MapPin,
    Calendar,
    ShoppingBag,
    TrendingUp,
    ChevronLeft,
    History,
    RotateCw,
    ArrowUpRight,
    Map as MapIcon,
    ChevronRight,
    Search,
    Package,
    IndianRupee,
    CheckCircle2,
    XCircle,
    Wallet,
    ShieldCheck,
    Copy,
    Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@shared/components/ui/Toast';

const CustomerDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [orderSearch, setOrderSearch] = useState('');
    const [visibleOrders, setVisibleOrders] = useState(5);
    const [copiedId, setCopiedId] = useState(false);

    const [customer, setCustomer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState([]);

    const fetchCustomerDetails = async (isBackground = false) => {
        try {
            if (!isBackground) setLoading(true);
            const { data } = await adminApi.getUserById(id);
            if (data.success && data.result) {
                const customerData = data.result;
                setCustomer(customerData);
                setOrders(customerData.recentOrders || []);
            } else {
                setCustomer(null);
            }
        } catch (error) {
            console.error('Error fetching customer details:', error);
            showToast(error.response?.data?.message || 'Failed to load customer profile', 'error');
            setCustomer(null);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        if (id) {
            fetchCustomerDetails();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchCustomerDetails(true);
        showToast('Customer data refreshed', 'success');
    };

    const handleCopyId = () => {
        if (!customer?.id) return;
        navigator.clipboard.writeText(customer.id);
        setCopiedId(true);
        showToast('Customer ID copied to clipboard', 'info');
        setTimeout(() => setCopiedId(false), 2000);
    };

    const safeOrders = useMemo(
        () => (Array.isArray(orders) ? orders : []),
        [orders]
    );

    const filteredOrders = useMemo(() => {
        return safeOrders.filter(o =>
            (o.id || '').toLowerCase().includes(orderSearch.toLowerCase()) ||
            (o.status || '').toLowerCase().includes(orderSearch.toLowerCase())
        ).slice(0, visibleOrders);
    }, [safeOrders, orderSearch, visibleOrders]);

    if (loading) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
                <div className="h-10 w-10 rounded-full border-3 border-primary border-t-transparent animate-spin" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading Customer Profile...</p>
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4 p-6 text-center">
                <div className="p-4 bg-slate-100 rounded-full text-slate-400 mb-2">
                    <XCircle className="h-10 w-10" />
                </div>
                <h3 className="text-xl font-black text-slate-800">Customer Not Found</h3>
                <p className="text-sm text-slate-500 max-w-sm">The customer record you are looking for does not exist or has been removed.</p>
                <button
                    onClick={() => navigate('/ecs/quick-commerce/customers')}
                    className="mt-2 px-6 py-3 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-hover transition-all shadow-md"
                >
                    Back to Customers
                </button>
            </div>
        );
    }

    const isActive = customer.status === 'active';
    const averageOrderValue = customer.totalOrders > 0
        ? Math.round(customer.totalSpent / customer.totalOrders)
        : 0;

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-16">
            {/* Header & Navigation Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1 mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/ecs/quick-commerce/customers')}
                        className="p-2.5 bg-white ring-1 ring-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm group"
                        title="Back to Customers"
                    >
                        <ChevronLeft className="h-5 w-5 text-slate-600 group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <div>
                        <div className="flex flex-wrap items-center gap-2.5">
                            <h1 className="ds-h1 tracking-tight">{customer.name}</h1>
                            <Badge
                                variant={isActive ? 'success' : 'error'}
                                className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5"
                            >
                                {customer.status}
                            </Badge>
                            <button
                                onClick={handleCopyId}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold transition-colors"
                                title="Click to copy ID"
                            >
                                <span>ID: {customer.id.length > 10 ? `${customer.id.slice(0, 8)}...` : customer.id}</span>
                                {copiedId ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 text-slate-400" />}
                            </button>
                        </div>
                        <p className="ds-description mt-1">Customer Profile & Order Activity</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRefresh}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white ring-1 ring-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                    >
                        <RotateCw className={cn("h-4 w-4 text-primary", isRefreshing && "animate-spin")} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Card className="p-5 border-none shadow-md ring-1 ring-slate-100 bg-white rounded-2xl flex items-center gap-4">
                    <div className="p-3.5 bg-emerald-50 rounded-2xl text-emerald-600 shrink-0">
                        <IndianRupee className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lifetime Spend</p>
                        <h3 className="text-2xl font-black text-slate-900 mt-0.5">₹{(customer.totalSpent || 0).toLocaleString()}</h3>
                        <p className="text-[11px] font-bold text-emerald-600 mt-0.5">Total Purchases</p>
                    </div>
                </Card>

                <Card className="p-5 border-none shadow-md ring-1 ring-slate-100 bg-white rounded-2xl flex items-center gap-4">
                    <div className="p-3.5 bg-orange-50 rounded-2xl text-primary shrink-0">
                        <ShoppingBag className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Orders</p>
                        <h3 className="text-2xl font-black text-slate-900 mt-0.5">{customer.totalOrders || 0}</h3>
                        <p className="text-[11px] font-bold text-slate-400 mt-0.5">Placed Lifetime</p>
                    </div>
                </Card>

                <Card className="p-5 border-none shadow-md ring-1 ring-slate-100 bg-white rounded-2xl flex items-center gap-4">
                    <div className="p-3.5 bg-indigo-50 rounded-2xl text-indigo-600 shrink-0">
                        <TrendingUp className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Average Order Value</p>
                        <h3 className="text-2xl font-black text-slate-900 mt-0.5">₹{averageOrderValue.toLocaleString()}</h3>
                        <p className="text-[11px] font-bold text-slate-400 mt-0.5">Per Delivered Order</p>
                    </div>
                </Card>

                <Card className="p-5 border-none shadow-md ring-1 ring-slate-100 bg-white rounded-2xl flex items-center gap-4">
                    <div className="p-3.5 bg-purple-50 rounded-2xl text-purple-600 shrink-0">
                        <Wallet className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Wallet Balance</p>
                        <h3 className="text-2xl font-black text-slate-900 mt-0.5">₹{(customer.walletBalance || 0).toLocaleString()}</h3>
                        <p className="text-[11px] font-bold text-purple-600 mt-0.5">Available Credits</p>
                    </div>
                </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 Columns: Profile Details & Order History */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Customer Profile Card */}
                    <Card className="p-6 bg-white rounded-2xl border-none shadow-md ring-1 ring-slate-100">
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                            <div className="relative shrink-0">
                                <img
                                    src={customer.avatar}
                                    alt={customer.name}
                                    className="h-24 w-24 rounded-2xl object-cover ring-4 ring-slate-100 shadow-sm bg-slate-50"
                                    onError={(e) => {
                                        e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(customer.name)}`;
                                    }}
                                />
                                <div
                                    className={cn(
                                        "absolute -bottom-1 -right-1 h-5 w-5 rounded-full ring-2 ring-white shadow-sm flex items-center justify-center",
                                        isActive ? "bg-emerald-500" : "bg-rose-500"
                                    )}
                                    title={isActive ? "Account Active" : "Account Inactive"}
                                />
                            </div>

                            <div className="flex-1 text-center sm:text-left">
                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                                    <h2 className="text-2xl font-black text-slate-900">{customer.name}</h2>
                                    {customer.isVerified && (
                                        <span title="Verified Customer" className="inline-flex items-center text-primary">
                                            <ShieldCheck className="h-5 w-5 fill-primary/10" />
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs font-semibold text-slate-400 mb-4 flex items-center justify-center sm:justify-start gap-1.5">
                                    <Calendar className="h-3.5 w-3.5" />
                                    Member since {customer.joinedDate ? new Date(customer.joinedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                        <div className="p-2 bg-white rounded-lg text-slate-500 shadow-xs">
                                            <Phone className="h-4 w-4 text-primary" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone</p>
                                            <a href={`tel:${customer.phone}`} className="text-xs font-bold text-slate-800 hover:text-primary transition-colors">
                                                {customer.phone || 'No phone provided'}
                                            </a>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                        <div className="p-2 bg-white rounded-lg text-slate-500 shadow-xs">
                                            <Mail className="h-4 w-4 text-primary" />
                                        </div>
                                        <div className="text-left overflow-hidden">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</p>
                                            <a href={`mailto:${customer.email}`} className="text-xs font-bold text-slate-800 hover:text-primary transition-colors truncate block">
                                                {customer.email || 'No email provided'}
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-1">Permissions:</span>
                                    <Badge variant="outline" className="text-[10px] font-bold text-slate-600 bg-slate-50">
                                        COD: {customer.isCodAllowed !== false ? 'Allowed' : 'Restricted'}
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px] font-bold text-slate-600 bg-slate-50">
                                        Status: {isActive ? 'Active' : 'Inactive'}
                                    </Badge>
                                    {customer.lastOrderDate && (
                                        <Badge variant="outline" className="text-[10px] font-bold text-slate-600 bg-slate-50">
                                            Last Order: {new Date(customer.lastOrderDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Recent Orders Section */}
                    <Card className="border-none shadow-md ring-1 ring-slate-100 bg-white rounded-2xl overflow-hidden">
                        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                    <History className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900">Recent Orders</h3>
                                    <p className="text-[11px] text-slate-400 font-semibold">{safeOrders.length} orders recorded</p>
                                </div>
                            </div>

                            <div className="relative w-full sm:w-56">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Filter orders..."
                                    value={orderSearch}
                                    onChange={(e) => setOrderSearch(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border-none rounded-xl text-xs font-semibold outline-none ring-1 ring-slate-200 focus:ring-primary/30 transition-all"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/75 border-b border-slate-100">
                                    <tr>
                                        <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Order ID</th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date & Time</th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Items</th>
                                        <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredOrders.length > 0 ? (
                                        filteredOrders.map((order, i) => {
                                            const orderTargetId = order.rawId || (order.id || '').replace('#', '');
                                            return (
                                                <tr
                                                    key={i}
                                                    onClick={() => navigate(`/ecs/quick-commerce/orders/view/${orderTargetId}`)}
                                                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                                                >
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="p-2 bg-slate-100 rounded-lg text-slate-500 group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                                                                <Package className="h-4 w-4" />
                                                            </div>
                                                            <span className="text-xs font-black text-slate-900 group-hover:text-primary transition-colors">
                                                                {order.id}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-xs font-bold text-slate-500">
                                                        {order.date ? new Date(order.date).toLocaleDateString('en-IN', {
                                                            day: 'numeric',
                                                            month: 'short',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        }) : 'N/A'}
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <Badge
                                                            variant={
                                                                order.status === 'delivered'
                                                                    ? 'success'
                                                                    : order.status === 'cancelled'
                                                                    ? 'error'
                                                                    : 'warning'
                                                            }
                                                            className="text-[9px] font-black uppercase tracking-wider"
                                                        >
                                                            {order.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-4 text-center text-xs font-bold text-slate-600">
                                                        {order.itemsCount || 0}
                                                    </td>
                                                    <td className="px-5 py-4 text-right font-black text-slate-900 text-xs">
                                                        ₹{(order.amount || 0).toLocaleString()}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-12 text-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <ShoppingBag className="h-8 w-8 text-slate-300" />
                                                    <p className="text-xs font-bold text-slate-400">No orders found</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {visibleOrders < safeOrders.length && (
                            <div className="p-3 bg-slate-50/50 flex justify-center border-t border-slate-100">
                                <button
                                    onClick={() => setVisibleOrders(safeOrders.length)}
                                    className="text-xs font-black text-primary hover:text-primary-hover flex items-center gap-1.5 transition-colors py-1"
                                >
                                    <span>Show all {safeOrders.length} orders</span>
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        )}
                    </Card>
                </div>

                {/* Right column: saved addresses */}
                <div className="space-y-6">
                    {/* Saved Addresses Card */}
                    <Card className="p-5 bg-white rounded-2xl border-none shadow-md ring-1 ring-slate-100">
                        <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100">
                            <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                <MapIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-900">Saved Addresses</h3>
                                <p className="text-[11px] text-slate-400 font-semibold">
                                    {(customer.addresses || []).length} addresses on file
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {(customer.addresses || []).length > 0 ? (
                                customer.addresses.map((addr, idx) => (
                                    <div
                                        key={addr.id || idx}
                                        className={cn(
                                            "p-4 rounded-xl ring-1 transition-all",
                                            addr.isDefault
                                                ? "bg-orange-50/40 ring-orange-200"
                                                : "bg-slate-50/80 ring-slate-100 hover:ring-slate-200"
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <Badge
                                                variant={addr.isDefault ? "primary" : "secondary"}
                                                className="text-[9px] font-black uppercase tracking-wider"
                                            >
                                                {addr.label || 'Home'}
                                            </Badge>
                                            {addr.isDefault && (
                                                <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                                                    Default
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs font-semibold text-slate-700 leading-relaxed break-words">
                                            {addr.fullAddress || `${addr.city || ''}, ${addr.state || ''} ${addr.pincode || ''}`.trim() || 'No street details'}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                    <MapPin className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-xs font-bold text-slate-400">No saved addresses</p>
                                </div>
                            )}
                        </div>
                    </Card>

                </div>
            </div>
        </div>
    );
};

export default CustomerDetail;
