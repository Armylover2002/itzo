import React, { useState, useMemo, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import PageHeader from '@shared/components/ui/PageHeader';
import StatCard from '@shared/components/ui/StatCard';
import {
    Users,
    Search,
    Download,
    Eye,
    Phone,
    ShoppingBag,
    UserPlus,
    RotateCw,
    Activity,
    Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import Pagination from '@shared/components/ui/Pagination';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';

const AUTO_REFRESH_INTERVAL_MS = 30000;

const CustomerManagement = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [isExporting, setIsExporting] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        fetchCustomers(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize]);

    const fetchCustomers = async (requestedPage = 1, options = {}) => {
        try {
            const isBackgroundRefresh = options.background === true;
            if (isBackgroundRefresh) {
                setIsRefreshing(true);
            } else {
                setLoading(true);
            }

            const { data } = await adminApi.getUsers({
                page: requestedPage,
                limit: pageSize,
                search: searchTerm || undefined,
            });
            if (data.success) {
                const payload = data.result || {};
                const list = Array.isArray(payload.items) ? payload.items : (data.results || []);
                setCustomers(list);
                if (typeof payload.total === 'number') {
                    setTotal(payload.total);
                } else {
                    setTotal(list.length);
                }
                if (typeof payload.page === 'number') {
                    setPage(payload.page);
                } else {
                    setPage(requestedPage);
                }
            }
        } catch (error) {
            console.error("Error fetching customers:", error);
            toast.error("Failed to load customers");
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    const [statusUpdatingId, setStatusUpdatingId] = useState(null);

    const handleToggleCustomerStatus = async (cust) => {
        const nextIsActive = cust.status !== 'active';
        setStatusUpdatingId(cust.id);
        try {
            const { data } = await adminApi.updateCustomerStatus(cust.id, nextIsActive);
            if (data.success) {
                const nextStatus = nextIsActive ? 'active' : 'inactive';
                setCustomers((prev) =>
                    prev.map((c) => (c.id === cust.id ? { ...c, status: nextStatus } : c))
                );
                toast.success(`Customer ${cust.name || ''} marked as ${nextStatus}`);
            } else {
                toast.error(data.message || 'Failed to update customer status');
            }
        } catch (error) {
            console.error('Error toggling customer status:', error);
            toast.error(error.response?.data?.message || 'Failed to update customer status');
        } finally {
            setStatusUpdatingId(null);
        }
    };

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            fetchCustomers(1);
        }, 250);

        return () => window.clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm]);

    useEffect(() => {
        const interval = window.setInterval(() => {
            fetchCustomers(page, { background: true });
        }, AUTO_REFRESH_INTERVAL_MS);

        return () => window.clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, pageSize, searchTerm]);

    const stats = useMemo(() => {
        const safeCustomers = Array.isArray(customers) ? customers : [];
        return {
            total: total,
            active: safeCustomers.filter(c => c.status === 'active').length,
            newToday: safeCustomers.filter(c => {
                const today = new Date().toISOString().split('T')[0];
                const joined = new Date(c.joinedDate).toISOString().split('T')[0];
                return joined === today;
            }).length
        };
    }, [customers, total]);

    const filteredCustomers = useMemo(() => {
        const safeCustomers = Array.isArray(customers) ? customers : [];
        return safeCustomers.filter(c => {
            const matchesSearch = (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (c.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (c.phone || '').includes(searchTerm);
            const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [customers, searchTerm, filterStatus]);

    const handleExport = () => {
        setIsExporting(true);
        setTimeout(() => {
            setIsExporting(false);
            toast.success('Customer database exported successfully!');
        }, 1500);
    };

    const getTimeAgo = (date) => {
        if (!date) return 'Never';
        const now = new Date();
        const past = new Date(date);
        const diffInMs = now - past;
        const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

        if (diffInHours < 1) return 'Recently';
        if (diffInHours < 24) return `${diffInHours}h ago`;
        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays}d ago`;
    };

    return (
        <div className="ds-section-spacing">
            <PageHeader
                title="Customers"
                description="Manage and track all customer accounts"
                badge={
                    <div className="ds-stat-card-icon bg-[#f7f3fc]">
                        <Users className="ds-icon-lg text-primary" />
                    </div>
                }
                actions={
                    <>
                        <button
                            onClick={handleExport}
                            disabled={isExporting}
                            className="ds-btn ds-btn-md bg-white ring-1 ring-gray-200 text-gray-700 hover:bg-gray-50"
                        >
                            {isExporting ? <RotateCw className="ds-icon-sm animate-spin" /> : <Download className="ds-icon-sm" />}
                            {isExporting ? 'EXPORTING...' : 'EXPORT'}
                        </button>
                    </>
                }
            />

            {/* Quick Stats Grid */}
            <div className="ds-grid-cards-3">
                <StatCard
                    label="Total Customers"
                    value={stats.total}
                    icon={Users}
                    color="text-primary"
                    bg="bg-[#f7f3fc]"
                />
                <StatCard
                    label="Active Users"
                    value={stats.active}
                    icon={Activity}
                    color="text-emerald-600"
                    bg="bg-emerald-50"
                />
                <StatCard
                    label="New Today"
                    value={stats.newToday}
                    icon={UserPlus}
                    color="text-primary"
                    bg="bg-[#f7f3fc]"
                />
            </div>

            {/* Filter & Search Bar */}
            <Card className="ds-card-compact">
                <div className="flex flex-col lg:flex-row gap-3">
                    <div className="flex-1 relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 ds-icon-sm text-gray-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by name, email or phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="ds-input pl-9"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        {isRefreshing && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold text-gray-400">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Syncing
                            </div>
                        )}
                        <div className="flex bg-gray-100 p-0.5 rounded-lg">
                            {['all', 'active', 'inactive'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-md ds-caption transition-all",
                                        filterStatus === status ? "bg-white text-primary shadow-sm" : "text-gray-400 hover:text-gray-600"
                                    )}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Customer List Table */}
            <Card className="overflow-hidden relative min-h-[400px]">
                {loading && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-8 w-8 text-primary animate-spin" />
                            <p className="ds-caption text-gray-500 font-medium">Loading Customers...</p>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="ds-table">
                        <thead className="ds-table-header">
                            <tr>
                                <th className="ds-table-header-cell">Customer</th>
                                <th className="ds-table-header-cell">Activity</th>
                                <th className="ds-table-header-cell">Total Spend</th>
                                <th className="ds-table-header-cell">Status</th>
                                <th className="ds-table-header-cell text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading && filteredCustomers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-4 bg-gray-50 rounded-full">
                                                <Users className="h-8 w-8 text-gray-300" />
                                            </div>
                                            <p className="ds-h4 text-gray-400">No customers found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredCustomers.map((cust) => (
                                    <tr key={cust.id} className="ds-table-row">
                                        <td className="ds-table-cell">
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={cust.avatar}
                                                    alt=""
                                                    className="h-10 w-10 rounded-lg bg-gray-100 ring-2 ring-white shadow-sm"
                                                    onError={(e) => {
                                                        e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${cust.name}`;
                                                    }}
                                                />
                                                <div>
                                                    <p
                                                        onClick={() => navigate(`/ecs/quick-commerce/customers/${cust.id}`)}
                                                        className="ds-h4 hover:text-primary cursor-pointer transition-colors"
                                                    >
                                                        {cust.name}
                                                    </p>
                                                    <p className="ds-body-sm text-gray-500">{cust.email || 'No email'}</p>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <Phone className="ds-icon-sm text-gray-300" />
                                                        <span className="text-[9px] text-gray-400">{cust.phone}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="ds-table-cell">
                                            <div>
                                                <div className="flex items-center gap-1.5 ds-body font-semibold">
                                                    <ShoppingBag className="ds-icon-sm text-primary" />
                                                    {cust.totalOrders} Orders
                                                </div>
                                                <p className="ds-body-sm text-gray-400 mt-0.5">Last: {getTimeAgo(cust.lastOrderDate)}</p>
                                            </div>
                                        </td>
                                        <td className="ds-table-cell ds-h4">
                                            ₹{(cust.totalSpent || 0).toLocaleString()}
                                        </td>
                                        <td className="ds-table-cell">
                                            <div className="flex items-center gap-2.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleCustomerStatus(cust)}
                                                    disabled={statusUpdatingId === cust.id}
                                                    className={cn(
                                                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                                                        cust.status === 'active' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-300 hover:bg-slate-400',
                                                        statusUpdatingId === cust.id && 'opacity-60 cursor-not-allowed'
                                                    )}
                                                    title={cust.status === 'active' ? 'Click to Deactivate Customer' : 'Click to Activate Customer'}
                                                >
                                                    <span
                                                        className={cn(
                                                            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out flex items-center justify-center",
                                                            cust.status === 'active' ? 'translate-x-5' : 'translate-x-0'
                                                        )}
                                                    >
                                                        {statusUpdatingId === cust.id ? (
                                                            <Loader2 className="h-3 w-3 animate-spin text-slate-500" />
                                                        ) : (
                                                            <span className={cn("h-1.5 w-1.5 rounded-full", cust.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400')} />
                                                        )}
                                                    </span>
                                                </button>
                                                <Badge
                                                    variant={cust.status === 'active' ? 'success' : 'error'}
                                                    className="ds-badge cursor-pointer select-none"
                                                    onClick={() => handleToggleCustomerStatus(cust)}
                                                >
                                                    {cust.status}
                                                </Badge>
                                            </div>
                                        </td>
                                        <td className="ds-table-cell text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => navigate(`/ecs/quick-commerce/customers/${cust.id}`)}
                                                    className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary hover:text-white transition-all"
                                                    title="View Profile"
                                                >
                                                    <Eye className="ds-icon-sm" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="px-6 py-3 border-t border-gray-100">
                    <Pagination
                        page={page}
                        totalPages={Math.ceil(total / pageSize) || 1}
                        total={total}
                        pageSize={pageSize}
                        onPageChange={(p) => fetchCustomers(p)}
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

export default CustomerManagement;
