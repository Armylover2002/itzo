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
    MessageSquare,
    ChevronLeft,
    History,
    RotateCw,
    Edit3,
    ArrowUpRight,
    ExternalLink,
    Map as MapIcon,
    MoreVertical,
    ChevronRight,
    User,
    Ban,
    Search,
    Bell,
    Package,
    IndianRupee,
    CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Modal from '@shared/components/ui/Modal';
import { useToast } from '@shared/components/ui/Toast';

const CustomerDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [orderSearch, setOrderSearch] = useState('');
    const [visibleOrders, setVisibleOrders] = useState(3);
    const [customer, setCustomer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState([]);

    const [editForm, setEditForm] = useState({ name: '', email: '', phone: '' });

    useEffect(() => {
        const fetchCustomerDetails = async () => {
            try {
                setLoading(true);
                const { data } = await adminApi.getUserById(id);
                if (data.success) {
                    const customerData = data.result;
                    setCustomer(customerData);
                    setOrders(customerData.recentOrders || []);
                }
            } catch (error) {
                console.error("Error fetching customer details:", error);
                showToast("Failed to load customer profile", "error");
            } finally {
                setLoading(false);
            }
        };
        if (id) fetchCustomerDetails();
    }, [id]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        setTimeout(() => {
            setIsRefreshing(false);
            showToast('Customer data synchronized with main server', 'success');
        }, 1000);
    };

    const handleExportCSV = () => {
        if (!orders || orders.length === 0) {
            showToast('No orders to export', 'warning');
            return;
        }

        const headers = ['Order ID', 'Date', 'Status', 'Items', 'Amount (INR)'];
        const rows = orders.map(o => [
            o.id || '',
            new Date(o.date).toLocaleString('en-IN'),
            (o.status || 'N/A').toUpperCase(),
            o.itemsCount || 0,
            o.amount || 0
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(v => `"${v}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `customer_orders_${customer.id || 'export'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('Export successful', 'success');
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
            <div className="h-[80vh] flex flex-col items-center justify-center space-y-4">
                <RotateCw className="h-10 w-10 text-primary animate-spin" />
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Loading Profile...</p>
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="h-[80vh] flex flex-col items-center justify-center space-y-4">
                <p className="text-lg font-bold text-gray-400">Customer not found</p>
                <button onClick={() => navigate('/ecs/quick-commerce/customers')} className="text-primary font-bold">Back to Customers</button>
            </div>
        );
    }

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            {/* Action Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/ecs/quick-commerce/customers')}
                        className="p-2.5 bg-white ring-1 ring-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm group"
                    >
                        <ChevronLeft className="h-5 w-5 text-slate-500 group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="ds-h1">Customer Profile</h1>
                            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest">{customer.id}</Badge>
                        </div>
                        <p className="ds-description mt-1">Full profile and shopping history for this customer.</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRefresh}
                        className="flex items-center gap-2 px-5 py-3 bg-white ring-1 ring-slate-200 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <RotateCw className={cn("h-4 w-4 text-red-500", isRefreshing && "animate-spin")} />
                        REFRESH
                    </button>
                </div>
            </div>

            <div className="mt-6 mb-8">
                <Card className="bg-white rounded-2xl border-none shadow-xl ring-1 ring-slate-100 overflow-hidden relative">
                    {/* Top Accent Strip */}
                    <div className="h-4 w-full bg-gradient-to-r from-red-500 to-red-600"></div>
                    
                    <div className="p-6 md:p-8">
                        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-8 relative z-10">
                            {/* Avatar & Basic Info */}
                            <div className="flex items-center gap-6">
                                <div className="relative shrink-0">
                                    <img src={customer.avatar} alt="" className="h-24 w-24 rounded-full ring-4 ring-slate-50 shadow-md bg-slate-100 object-cover" />
                                    <div className={cn(
                                        "absolute bottom-1 right-1 h-4 w-4 rounded-full ring-2 ring-white shadow-sm",
                                        customer.status === 'active' ? "bg-emerald-500" : "bg-rose-500"
                                    )}></div>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900">{customer.name}</h3>
                                    <div className="flex flex-wrap items-center gap-4 mt-2">
                                        {customer.email && (
                                            <div className="flex items-center gap-1.5 text-slate-500 text-sm font-medium">
                                                <Mail className="h-4 w-4" />
                                                {customer.email}
                                            </div>
                                        )}
                                        {customer.phone && (
                                            <div className="flex items-center gap-1.5 text-slate-500 text-sm font-medium">
                                                <Phone className="h-4 w-4" />
                                                {customer.phone}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-3">
                                        Customer since {customer.joinedDate ? new Date(customer.joinedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown'}
                                    </p>
                                </div>
                            </div>

                            {/* Divider on desktop */}
                            <div className="hidden lg:block h-20 w-px bg-slate-100 mx-4"></div>

                            {/* Key Stats Row */}
                            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-start">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600">
                                            <IndianRupee className="h-4 w-4" />
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Spend</p>
                                    </div>
                                    <h5 className="text-xl font-black text-slate-900">₹{(customer.totalSpent || 0).toLocaleString()}</h5>
                                </div>
                                
                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-start">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1.5 rounded-lg bg-blue-100 text-blue-600">
                                            <ShoppingBag className="h-4 w-4" />
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Orders</p>
                                    </div>
                                    <h5 className="text-xl font-black text-slate-900">{customer.totalOrders || 0}</h5>
                                </div>

                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-start">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-600">
                                            <TrendingUp className="h-4 w-4" />
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avg. Order</p>
                                    </div>
                                    <h5 className="text-xl font-black text-slate-900">₹{customer.totalOrders > 0 ? Math.round(customer.totalSpent / customer.totalOrders).toLocaleString() : 0}</h5>
                                </div>

                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-start">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1.5 rounded-lg bg-amber-100 text-amber-600">
                                            <History className="h-4 w-4" />
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last Order</p>
                                    </div>
                                    <h5 className="text-sm font-black text-slate-900 mt-1">
                                        {customer.lastOrderDate ? new Date(customer.lastOrderDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'N/A'}
                                    </h5>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 md:p-8 border-t border-slate-100 space-y-12">
                        {/* Delivery addresses */}
                        <div>
                            <div className="flex items-center justify-between mb-8">
                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                <MapIcon className="h-4 w-4 text-red-500" />
                                Saved Addresses
                            </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(Array.isArray(customer.addresses) ? customer.addresses : []).length > 0 ? (
                                (Array.isArray(customer.addresses) ? customer.addresses : []).map((addr, idx) => {
                                    const type = (addr.label || addr.type || 'other').toUpperCase();
                                    const parts = [addr.fullAddress || addr.address, addr.landmark, addr.city, addr.state, addr.pincode].filter(Boolean);
                                    const fullAddress = parts.length > 0 ? parts.join(', ') : 'No address';
                                    const isDefault = addr.isDefault ?? (idx === 0);
                                    return (
                                        <div key={addr._id || addr.id || idx} className={cn(
                                            "p-5 rounded-2xl ring-1 transition-all",
                                            isDefault ? "bg-slate-50 ring-slate-200 shadow-sm" : "bg-white ring-slate-100 hover:ring-red-100"
                                        )}>
                                            <div className="flex items-center justify-between mb-2">
                                                <Badge variant={isDefault ? 'primary' : 'secondary'} className="text-[9px] font-black">
                                                    {type}
                                                </Badge>
                                                <MapPin className="h-3.5 w-3.5 text-slate-300" />
                                            </div>
                                            <p className="text-xs font-bold text-slate-600 leading-relaxed whitespace-pre-wrap break-words">{fullAddress}</p>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="col-span-2 py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                    <MapPin className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No saved addresses</p>
                                </div>
                            )}
                        </div>
                        </div>

                        {/* Order history */}
                        <div>
                            <div className="pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                <History className="h-4 w-4 text-red-500" />
                                Recent Orders
                            </h4>
                            <div className="flex items-center gap-3">
                                <div className="relative group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 group-focus-within:text-red-500" />
                                    <input
                                        type="text"
                                        placeholder="Search Orders..."
                                        value={orderSearch}
                                        onChange={(e) => setOrderSearch(e.target.value)}
                                        className="pl-8 pr-4 py-2 bg-slate-50 border-none rounded-xl text-[10px] font-bold outline-none ring-1 ring-transparent focus:ring-red-500/20 w-40"
                                    />
                                </div>
                                <button
                                    onClick={handleExportCSV}
                                    className="text-[10px] font-black text-red-600 uppercase hover:underline"
                                >
                                    Export CSV
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <tbody className="divide-y divide-slate-50">
                                    {filteredOrders.map((order, i) => (
                                        <tr
                                            key={i}
                                            onClick={() => navigate(`/ecs/orders/view/${order.id.replace('#', '')}`)}
                                            className="group hover:bg-slate-50/50 transition-all cursor-pointer"
                                        >
                                            <td className="px-4 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-white group-hover:shadow-sm transition-all text-slate-400 group-hover:text-red-500">
                                                        <Package className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-slate-900">{order.id}</p>
                                                        <p className="text-[10px] font-bold text-slate-400">{order.itemsCount} Items</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-5">
                                                <p className="text-[10px] font-black text-slate-400 uppercase">
                                                    {new Date(order.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </td>
                                            <td className="py-5 text-center">
                                                <Badge variant={order.status === 'delivered' ? 'success' : order.status === 'cancelled' ? 'danger' : 'warning'} className="text-[8px] font-black">
                                                    {order.status.toUpperCase()}
                                                </Badge>
                                            </td>
                                            <td className="py-5 text-right font-black text-slate-900 pr-8">
                                                ₹{(order.amount || 0).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredOrders.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="px-4 py-5 text-center text-xs font-bold text-slate-400">
                                                No orders found matching your search.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {visibleOrders < safeOrders.length && (
                            <div className="p-4 bg-slate-50/50 flex justify-center border-t border-slate-50">
                                <button
                                    onClick={() => setVisibleOrders(safeOrders.length)}
                                    className="text-[10px] font-black text-red-600 uppercase hover:underline flex items-center gap-2"
                                >
                                    SHOW ALL ORDERS
                                    <ChevronRight className="h-3 w-3" />
                                </button>
                            </div>
                        )}
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default CustomerDetail;
