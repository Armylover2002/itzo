import React, { useState, useMemo } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import {
    Users,
    UserCheck,
    Activity,
    Trophy,
    Search,
    Filter,
    Plus,
    MoreVertical,
    Phone,
    MapPin,
    Truck,
    User,
    Star,
    DollarSign,
    ShieldCheck,
    XCircle,
    Pencil,
    Trash2,
    Eye,
    X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import Pagination from '@shared/components/ui/Pagination';
import { adminApi } from '../services/adminApi';

const ActiveDeliveryBoys = () => {
    const [riders, setRiders] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedRider, setSelectedRider] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [viewingRider, setViewingRider] = useState(null);

    // Form states
    const [formState, setFormState] = useState({
        name: '', phone: '', email: '', vehicle: '', vehicleNum: '', location: ''
    });

    // Fetch Riders
    const fetchRiders = async (requestedPage = 1) => {
        setIsLoading(true);
        try {
            const response = await adminApi.getDeliveryPartners({ page: requestedPage, limit: pageSize });
            const payload = response.data.result || {};
            const data = Array.isArray(payload.items) ? payload.items : (response.data.results || response.data.result || []);

            const mappedRiders = data.map(r => ({
                id: r._id,
                name: r.name,
                phone: r.phone,
                email: r.email,
                status: r.isOnline ? 'available' : 'offline',
                vehicle: r.vehicleType,
                vehicleNum: r.vehicleNumber || 'N/A',
                rating: 4.5, // Mock rating for now
                totalOrders: 0, // Mock total orders
                todayEarnings: 0, // Mock earnings
                location: r.currentArea || 'Unknown',
                lastSync: 'Now',
                joinDate: new Date(r.createdAt).toLocaleDateString()
            }));

            setRiders(mappedRiders);
            setTotal(typeof payload.total === 'number' ? payload.total : mappedRiders.length);
            setPage(typeof payload.page === 'number' ? payload.page : requestedPage);
        } catch (error) {
            console.error('Fetch Riders Error:', error);
            toast.error('Failed to fetch delivery partners');
        } finally {
            setIsLoading(false);
        }
    };

    React.useEffect(() => {
        fetchRiders(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize]);

    // Filtering logic
    const filteredRiders = useMemo(() => {
        return riders.filter(r => {
            const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.phone.includes(searchTerm);
            const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [riders, searchTerm, statusFilter]);

    const handleAction = (type, rider) => {
        if (type === 'view') {
            setViewingRider(rider);
        } else if (type === 'edit') {
            setFormState(rider);
            setSelectedRider(rider);
            setIsEditModalOpen(true);
        } else if (type === 'delete') {
            if (window.confirm(`Are you sure you want to deactivate ${rider.name}?`)) {
                setRiders(riders.filter(r => r.id !== rider.id));
            }
        }
    };

    const handleEditSubmit = (e) => {
        e.preventDefault();
        setRiders(riders.map(r => r.id === selectedRider.id ? { ...r, ...formState } : r));
        setIsEditModalOpen(false);
        setSelectedRider(null);
    };

    const stats = [
        { label: 'Total Riders', value: riders.length, color: 'orange', icon: Users, description: 'Total fleet size' },
        { label: 'Available', value: riders.filter(r => r.status === 'available').length, color: 'emerald', icon: UserCheck, description: 'Ready for orders' },
        { label: 'Busy (On Task)', value: riders.filter(r => r.status === 'busy').length, color: 'amber', icon: Activity, description: 'Currently delivering' },
        { label: 'Top Earners', value: riders.filter(r => r.rating >= 4.5).length, color: 'rose', icon: Trophy, description: 'High performance' },
    ];

    return (
        <div className="ds-section-spacing animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        Delivery Boys
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    </h1>
                    <p className="ds-description mt-1">Manage all your active delivery partners here.</p>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, idx) => (
                    <Card key={idx} className="p-6 border-none shadow-xl ring-1 ring-slate-100 hover:ring-primary/20 transition-all group overflow-hidden relative">
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <p className="ds-label mb-2">{stat.label}</p>
                                <h3 className="ds-stat-medium">{stat.value}</h3>
                            </div>
                            <div className={cn(
                                "p-3 rounded-2xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-lg",
                                stat.color === 'orange' ? "bg-primary/10 text-primary shadow-orange-100" :
                                    stat.color === 'emerald' ? "bg-emerald-500/10 text-emerald-600 shadow-emerald-100" :
                                        stat.color === 'amber' ? "bg-amber-500/10 text-amber-600 shadow-amber-100" :
                                            "bg-rose-500/10 text-rose-600 shadow-rose-100"
                            )}>
                                <stat.icon className="h-5 w-5" strokeWidth={2.5} />
                            </div>
                        </div>
                        {/* Decorative background element */}
                        <div className="absolute -bottom-6 -right-6 h-24 w-24 bg-slate-50 rounded-full group-hover:scale-150 transition-transform duration-700" />
                    </Card>
                ))}
            </div>

            {/* Filters & Search Section */}
            <Card className="p-4 border-none shadow-sm ring-1 ring-slate-100 bg-white/50 backdrop-blur-xl">
                <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1 relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by name or phone number..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-100/50 border-none rounded-2xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-100/50 p-1 rounded-2xl flex items-center">
                            {['all', 'available', 'busy', 'offline'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={cn(
                                        "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                                        statusFilter === status
                                            ? "bg-white text-slate-900 shadow-sm"
                                            : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                        <button className="p-3.5 bg-white ring-1 ring-slate-200 rounded-2xl text-slate-600 hover:text-primary hover:ring-primary/30 transition-all shadow-sm">
                            <Filter className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </Card>

            {/* Riders Grid View */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 relative min-h-[300px]">
                {isLoading && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-sm rounded-3xl">
                        <div className="flex flex-col items-center gap-3">
                            <div className="h-10 w-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fetching fleet...</p>
                        </div>
                    </div>
                )}
                <AnimatePresence mode='popLayout'>
                    {!isLoading && filteredRiders.length === 0 ?
                        <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                            <User className="h-10 w-10 text-slate-300 mx-auto mb-4" />
                            <p className="text-sm font-bold text-slate-500">No delivery partners found matching your filters.</p>
                        </div>
                        :
                        filteredRiders.map((rider) => (
                            <motion.div
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                key={rider.id}
                            >
                                <Card className="group border-none shadow-xl ring-1 ring-slate-100 hover:ring-primary/20 transition-all overflow-hidden bg-white">
                                    <div className="p-6 space-y-5">
                                        {/* Rider Top Header */}
                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-4">
                                                <div className="relative">
                                                    <div className="h-14 w-14 rounded-[22px] bg-slate-100 flex items-center justify-center text-slate-400 group-hover:scale-105 transition-transform">
                                                        <User className="h-8 w-8" />
                                                    </div>
                                                    <div className={cn(
                                                        "absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-4 border-white shadow-sm",
                                                        rider.status === 'available' ? 'bg-emerald-500' :
                                                            rider.status === 'busy' ? 'bg-amber-500' : 'bg-slate-300'
                                                    )} />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-slate-900 group-hover:text-primary transition-colors">{rider.name}</h4>
                                                    <div className="flex items-center gap-1.5 mt-1 text-slate-500">
                                                        <Phone className="h-3 w-3" />
                                                        <span className="text-[10px] font-bold">{rider.phone}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-1 rounded-lg">
                                                <Star className="h-3 w-3 fill-current" />
                                                <span className="text-[10px] font-black">{rider.rating}</span>
                                            </div>
                                        </div>

                                        {/* Metrics Row */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-slate-50 p-3 rounded-2xl">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Today Earnings</p>
                                                <div className="flex items-center gap-1.5">
                                                    <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                                                    <span className="text-xs font-black text-slate-900">₹{rider.todayEarnings}</span>
                                                </div>
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-2xl">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Total Success</p>
                                                <div className="flex items-center gap-1.5">
                                                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                                                    <span className="text-xs font-black text-slate-900">{rider.totalOrders} Deliv.</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Location & Vehicle */}
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-slate-500">
                                                <MapPin className="h-3.5 w-3.5 shrink-0" />
                                                <span className="text-[10px] font-semibold truncate">{rider.location}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-500">
                                                <Truck className="h-3.5 w-3.5 shrink-0" />
                                                <span className="text-[10px] font-semibold truncate">{rider.vehicle} • <span className="text-slate-900 font-bold">{rider.vehicleNum}</span></span>
                                            </div>
                                        </div>

                                        {/* Action Footer */}
                                        <div className="pt-2 flex items-center gap-2">
                                            <button
                                                onClick={() => handleAction('view', rider)}
                                                className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-bold shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
                                            >
                                                <Eye className="h-3.5 w-3.5" />
                                                VIEW PROFILE
                                            </button>
                                            <button
                                                onClick={() => handleAction('edit', rider)}
                                                className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-orange-50 hover:text-primary-hover transition-all"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleAction('delete', rider)}
                                                className="p-2.5 bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-all"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        ))
                    }
                </AnimatePresence>
            </div>
            <div className="mt-6 flex justify-center">
                <Pagination
                    page={page}
                    totalPages={Math.ceil(total / pageSize) || 1}
                    total={total}
                    pageSize={pageSize}
                    onPageChange={(p) => fetchRiders(p)}
                    onPageSizeChange={(newSize) => {
                        setPageSize(newSize);
                        setPage(1);
                    }}
                    loading={isLoading}
                />
            </div>

            {/* Profile Detail Modal */}
            <AnimatePresence>
                {viewingRider && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                            onClick={() => setViewingRider(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="w-full max-w-2xl relative z-10 bg-white rounded-2xl shadow-2xl overflow-hidden"
                        >
                            <div className="p-10">
                                <div className="flex justify-between items-start mb-10">
                                    <div className="flex gap-6">
                                        <div className="h-24 w-24 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                                            <User className="h-14 w-14" />
                                        </div>
                                        <div>
                                            <h2 className="ds-h1">{viewingRider.name}</h2>
                                            <div className="flex items-center gap-3 mt-2">
                                                <Badge variant={viewingRider.status === 'available' ? 'success' : viewingRider.status === 'busy' ? 'warning' : 'neutral'} className="uppercase font-black text-[9px] px-3">
                                                    {viewingRider.status}
                                                </Badge>
                                                <span className="text-xs font-bold text-slate-400">Rider ID: RD-00{viewingRider.id.slice(1)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => setViewingRider(null)} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all">
                                        <XCircle className="h-6 w-6 text-slate-400" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Number</p>
                                        <p className="text-sm font-bold text-slate-900">{viewingRider.phone}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">User Id</p>
                                        <p className="text-sm font-bold text-slate-900">{viewingRider.email}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fleet Partner Since</p>
                                        <p className="text-sm font-bold text-slate-900">{viewingRider.joinDate}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vehicle Assigned</p>
                                        <p className="text-sm font-bold text-slate-900">{viewingRider.vehicle}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registration No.</p>
                                        <p className="text-sm font-bold text-slate-900">{viewingRider.vehicleNum}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Synced Area</p>
                                        <p className="text-sm font-bold text-slate-900">{viewingRider.location}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-slate-50 rounded-xl">
                                    <div className="text-center">
                                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Lifetime Rating</p>
                                        <div className="flex justify-center items-center gap-1">
                                            <Star className="h-4 w-4 text-amber-500 fill-current" />
                                            <span className="text-lg font-black text-slate-900">{viewingRider.rating}</span>
                                        </div>
                                    </div>
                                    <div className="text-center border-l border-slate-200">
                                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Fleet Rank</p>
                                        <span className="text-lg font-black text-slate-900">#42</span>
                                    </div>
                                    <div className="text-center border-l border-slate-200">
                                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Total Deliveries</p>
                                        <span className="text-lg font-black text-slate-900 text-primary">{viewingRider.totalOrders}</span>
                                    </div>
                                    <div className="text-center border-l border-slate-200">
                                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Wallet Creds</p>
                                        <span className="text-lg font-black text-slate-900 text-emerald-600">₹4,250</span>
                                    </div>
                                </div>

                                <div className="mt-8 flex gap-4">
                                    <button className="flex-1 py-4 bg-primary text-primary-foreground rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-primary/90 hover:shadow-primary/20 active:scale-95 transition-all">
                                        Send Message
                                    </button>
                                    <button className="px-6 py-4 bg-rose-50 text-rose-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-100 transition-all active:scale-95">
                                        DEACTIVATE
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Edit Modal */}
            <AnimatePresence>
                {isEditModalOpen && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-lg"
                            onClick={() => {
                                setIsEditModalOpen(false);
                            }}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 30 }}
                            className="w-full max-w-lg relative z-[120] bg-white rounded-2xl p-5 shadow-3xl"
                        >
                            <h3 className="ds-h2 mb-2">
                                Edit Rider
                            </h3>
                            <p className="ds-label mt-1 text-slate-500">
                                Update rider details below.
                            </p>

                            <form onSubmit={handleEditSubmit} className="space-y-5">
                                <div className="grid grid-cols-1 gap-5">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Identity Name</label>
                                        <input
                                            required
                                            type="text"
                                            value={formState.name}
                                            onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                                            className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                                            placeholder="e.g. Rahul Sharma"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Secure Contact</label>
                                            <input
                                                required
                                                type="text"
                                                value={formState.phone}
                                                onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                                                className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                                                placeholder="+91..."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Work Vehicle</label>
                                            <select
                                                required
                                                value={formState.vehicle}
                                                onChange={(e) => setFormState({ ...formState, vehicle: e.target.value })}
                                                className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10 transition-all appearance-none"
                                            >
                                                <option value="">Select Vehicle</option>
                                                <option>Two Wheeler</option>
                                                <option>Electric Scooter</option>
                                                <option>Cycle</option>
                                                <option>Three Wheeler</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Registration Vehicle No.</label>
                                        <input
                                            required
                                            type="text"
                                            value={formState.vehicleNum}
                                            onChange={(e) => setFormState({ ...formState, vehicleNum: e.target.value })}
                                            className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                                            placeholder="e.g. MH-12-AB-0000"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Operational Area</label>
                                        <input
                                            required
                                            type="text"
                                            value={formState.location}
                                            onChange={(e) => setFormState({ ...formState, location: e.target.value })}
                                            className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                                            placeholder="e.g. Bandra West, Mumbai"
                                        />
                                    </div>
                                </div>

                                <button type="submit" className="w-full py-4.5 bg-primary text-primary-foreground rounded-2xl text-xs font-black uppercase tracking-widest shadow-2xl hover:bg-primary/90 hover:shadow-primary/20 transition-all transform active:scale-[0.98] mt-4">
                                    SAVE CHANGES
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ActiveDeliveryBoys;
