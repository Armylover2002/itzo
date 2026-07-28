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

    // Modal states
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
    const [isRestrictModalOpen, setIsRestrictModalOpen] = useState(false);

    // Form states
    const [notifMessage, setNotifMessage] = useState('');
    const [notes, setNotes] = useState('Prefer morning deliveries. Use the building entrance on the north side.');

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
                    setEditForm({
                        name: customerData.name,
                        email: customerData.email,
                        phone: customerData.phone
                    });
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

    const handleUpdateProfile = (e) => {
        e.preventDefault();
        setCustomer({ ...editForm });
        setIsEditModalOpen(false);
        showToast('Profile updated successfully', 'success');
    };

    const handleSendNotif = () => {
        if (!notifMessage.trim()) return;
        setIsNotifModalOpen(false);
        setNotifMessage('');
        showToast('Notification sent to user', 'success');
    };

    const handleRestrictAccount = () => {
        const newStatus = customer.status === 'active' ? 'restricted' : 'active';
        setCustomer({ ...customer, status: newStatus });
        setIsRestrictModalOpen(false);
        showToast(`Account successfully ${newStatus === 'restricted' ? 'restricted' : 'activated'}`, newStatus === 'restricted' ? 'warning' : 'success');
    };

    const handleSaveNotes = () => {
        showToast('Internal CRM notes updated', 'info');
    };

    const handleExportCSV = () => {
        showToast('Archive export initiated. CSV will be ready shortly.', 'info');
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
                        <RotateCw className={cn("h-4 w-4 text-primary", isRefreshing && "animate-spin")} />
                        REFRESH
                    </button>
                    <button
                        onClick={() => {
                            setEditForm({ ...customer });
                            setIsEditModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-2xl text-xs font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95 shadow-slate-200"
                    >
                        <Edit3 className="h-4 w-4" />
                        EDIT PROFILE
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Main Profile Info */}
                <Card className="lg:col-span-2 bg-white rounded-xl p-4 border-none shadow-xl ring-1 ring-slate-100 overflow-hidden relative">
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-4 relative z-10">
                        <div className="relative shrink-0">
                            <img src={customer.avatar} alt="" className="h-32 w-32 rounded-xl ring-4 ring-slate-50 shadow-lg bg-slate-100" />
                            <div className={cn(
                                "absolute -bottom-1 -right-1 h-5 w-5 rounded-full ring-4 ring-white shadow-sm",
                                customer.status === 'active' ? "bg-emerald-500" : "bg-rose-500"
                            )}></div>
                        </div>
                        <div className="flex-1 text-center md:text-left space-y-6">
                            <div>
                                <h3 className="text-3xl font-black text-slate-900">{customer.name}</h3>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                                    Customer since {new Date(customer.joinedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {[
                                    { label: 'Total Spend', value: `₹${(customer.totalSpent || 0).toLocaleString()}`, trend: 'Lifetime', icon: IndianRupee, color: 'emerald' },
                                    { label: 'Orders Placed', value: customer.totalOrders || 0, trend: 'Lifetime', icon: ShoppingBag, color: 'orange' },
                                    { label: 'Average Spend', value: `₹${customer.totalOrders > 0 ? Math.round(customer.totalSpent / customer.totalOrders).toLocaleString() : 0}`, trend: 'Per Order', icon: TrendingUp, color: 'orange' },
                                    { label: 'Account Status', value: (customer.status || '').toUpperCase(), trend: 'Current', icon: CheckCircle2, color: 'fuchsia' },
                                ].map((stat, i) => (
                                    <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center">
                                        <div className={cn("p-2 rounded-full mb-2",
                                            stat.color === 'emerald' && 'bg-emerald-100 text-emerald-600',
                                            stat.color === 'orange' && 'bg-orange-100 text-primary',
                                            stat.color === 'orange' && 'bg-orange-100 text-primary',
                                            stat.color === 'fuchsia' && 'bg-fuchsia-100 text-fuchsia-600',
                                        )}>
                                            <stat.icon className="h-4 w-4" />
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                                        <h5 className="text-lg font-black text-slate-900 mt-1">{stat.value}</h5>
                                        <p className="text-xs font-bold text-slate-500 mt-0.5">{stat.trend}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Quick Stats */}
                <div className="space-y-4">
                    <Card className="p-6 !bg-primary text-white rounded-xl border-none shadow-lg shadow-orange-200 relative overflow-hidden group">
                        <div className="relative z-10">
                            <p className="text-[10px] font-black opacity-90 uppercase tracking-widest mb-1">Lifetime Value</p>
                            <h4 className="text-3xl font-black text-white">₹{(customer.totalSpent || 0).toLocaleString()}</h4>
                            <div className="mt-4 flex items-center gap-2">
                                <div className="p-1 px-2 rounded-full bg-white/25 text-white text-[10px] font-black uppercase tracking-tighter">
                                    {customer.totalOrders} Orders
                                </div>
                                <TrendingUp className="h-4 w-4 text-white/90" />
                            </div>
                        </div>
                        <ShoppingBag className="absolute -bottom-4 -right-4 h-24 w-24 text-white/10 group-hover:scale-110 transition-transform" />
                    </Card>

                    <Card className="p-6 bg-white rounded-xl border-none shadow-md ring-1 ring-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Recent Activity</p>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-50 rounded-xl text-amber-500">
                                <RotateCw className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-700">Last Order placed</p>
                                <p className="text-[10px] font-semibold text-slate-400">
                                    {customer.lastOrderDate ? new Date(customer.lastOrderDate).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Delivery & Order History */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Delivery addresses */}
                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl p-4">
                        <div className="flex items-center justify-between mb-8">
                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                <MapIcon className="h-4 w-4 text-primary" />
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
                                            isDefault ? "bg-slate-50 ring-slate-200 shadow-sm" : "bg-white ring-slate-100 hover:ring-orange-100"
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
                    </Card>

                    {/* Order history */}
                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
                        <div className="p-4 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                <History className="h-4 w-4 text-primary" />
                                Recent Orders
                            </h4>
                            <div className="flex items-center gap-3">
                                <div className="relative group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 group-focus-within:text-primary" />
                                    <input
                                        type="text"
                                        placeholder="Search Orders..."
                                        value={orderSearch}
                                        onChange={(e) => setOrderSearch(e.target.value)}
                                        className="pl-8 pr-4 py-2 bg-slate-50 border-none rounded-xl text-[10px] font-bold outline-none ring-1 ring-transparent focus:ring-primary/20 w-40"
                                    />
                                </div>
                                <button
                                    onClick={handleExportCSV}
                                    className="text-[10px] font-black text-primary uppercase hover:underline"
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
                                                    <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-white group-hover:shadow-sm transition-all text-slate-400 group-hover:text-primary">
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
                                    className="text-[10px] font-black text-primary uppercase hover:underline flex items-center gap-2"
                                >
                                    SHOW ALL ORDERS
                                    <ChevronRight className="h-3 w-3" />
                                </button>
                            </div>
                        )}
                    </Card>
                </div>

                {/* Sidebar Notes */}
                <div className="space-y-6">
                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl p-4">
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-primary" />
                            Internal Notes
                        </h4>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full bg-slate-50 p-6 rounded-2xl min-h-[140px] text-sm font-bold text-slate-600 leading-relaxed italic border border-slate-100 outline-none focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all"
                        />
                        <button
                            onClick={handleSaveNotes}
                            className="w-full mt-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            UPDATE NOTES
                        </button>
                    </Card>

                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-slate-900 rounded-xl p-4 text-white">
                        <h4 className="text-xs font-black opacity-40 uppercase tracking-widest mb-6">Account Control</h4>
                        <div className="space-y-4">
                            <button
                                onClick={() => setIsNotifModalOpen(true)}
                                className="w-full py-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-xl shadow-orange-900/20 flex items-center justify-center gap-2"
                            >
                                <MessageSquare className="h-4 w-4" />
                                SEND NOTIFICATION
                            </button>
                            <button
                                onClick={() => setIsRestrictModalOpen(true)}
                                className="w-full py-4 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-2xl font-black text-[11px] uppercase tracking-widest border border-rose-500/20 transition-all flex items-center justify-center gap-2"
                            >
                                <Ban className="h-4 w-4" />
                                {customer.status === 'active' ? 'BLOCK ACCOUNT' : 'UNBLOCK ACCOUNT'}
                            </button>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Modals */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Profile Details">
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Full Name</label>
                            <input
                                type="text"
                                value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/10 transition-all shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Phone Number</label>
                            <input
                                type="text"
                                value={editForm.phone}
                                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/10 transition-all shadow-sm"
                            />
                        </div>
                    </div>
                    <button type="submit" className="w-full py-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg active:scale-95">
                        SAVE CHANGES
                    </button>
                </form>
            </Modal>

            <Modal isOpen={isNotifModalOpen} onClose={() => setIsNotifModalOpen(false)} title="Send Notification">
                <div className="space-y-6">
                    <div className="p-4 bg-orange-50 rounded-2xl flex items-start gap-3">
                        <Bell className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <p className="text-xs font-bold text-orange-700 leading-relaxed">
                            We will send notifications via app and SMS immediately.
                        </p>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Message</label>
                        <textarea
                            value={notifMessage}
                            onChange={(e) => setNotifMessage(e.target.value)}
                            placeholder="Type your message here..."
                            className="w-full px-5 py-5 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/10 transition-all shadow-sm min-h-[120px]"
                        />
                    </div>
                    <button
                        onClick={handleSendNotif}
                        disabled={!notifMessage.trim()}
                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50"
                    >
                        SEND MESSAGE
                    </button>
                </div>
            </Modal>

            <Modal isOpen={isRestrictModalOpen} onClose={() => setIsRestrictModalOpen(false)} title="Confirm Action">
                <div className="space-y-6">
                    <div className="p-6 bg-rose-50 rounded-xl border border-rose-100 flex flex-col items-center text-center gap-4">
                        <div className="p-3 bg-rose-500 text-white rounded-full">
                            <Ban className="h-6 w-6" />
                        </div>
                        <h5 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                            Confirm Account {customer.status === 'active' ? 'Block' : 'Unblock'}?
                        </h5>
                        <p className="text-sm font-bold text-slate-500 leading-relaxed">
                            {customer.status === 'active'
                                ? 'This will block the customer from placing orders or logging in.'
                                : 'This will allow the customer to use all platform features again.'
                            }
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setIsRestrictModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-all">
                            CANCEL
                        </button>
                        <button onClick={handleRestrictAccount} className="flex-1 py-4 bg-rose-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-rose-600 shadow-xl shadow-rose-200 transition-all">
                            CONFIRM
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default CustomerDetail;
