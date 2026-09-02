import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { 
    Search, Download, Plus, Edit3, Trash2, ChevronDown, FileText, 
    FileSpreadsheet, Code, Check, Settings2, Loader2, AlertCircle, 
    Calendar, DollarSign, Activity, Truck, CreditCard, Clock, RefreshCw, 
    Layers, ArrowUpRight, Copy 
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@food/components/ui/dialog";
import { toast } from "react-hot-toast";
import { adminAPI } from "@food/api";
import dayjs from "dayjs";
import { useAuth } from "@core/context/AuthContext";
import { getCurrentUser } from "@food/utils/auth";
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions";
import { loadBusinessSettings } from "@common/utils/businessSettings";
import { 
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
    Tooltip as ChartTooltip, PieChart, Pie, Cell, Legend 
} from "recharts";

const DURATION_UNITS = [
    { label: 'Day', value: 'DAY' },
    { label: 'Week', value: 'WEEK' },
    { label: 'Month', value: 'MONTH' },
    { label: 'Year', value: 'YEAR' }
];

export default function SubscriptionManagement() {
    const { user: authUser } = useAuth();
    const currentUser = useMemo(() => authUser || getCurrentUser("admin"), [authUser]);
    // --- EXISTING PLAN MANAGEMENT STATE ---
    const [activeTab, setActiveTab] = useState("RESTAURANT");
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);
    const [showInactive, setShowInactive] = useState(false);
    const [resolvedPermissions, setResolvedPermissions] = useState({});
    // Subscription requirement per partner type (defaults to enforced = current flow)
    const [enforcement, setEnforcement] = useState({ restaurant: true, deliveryPartner: true });
    const [enforcementLoading, setEnforcementLoading] = useState(true);
    const [enforcementSaving, setEnforcementSaving] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        price: "",
        durationValue: 1,
        durationUnit: "DAY",
        isActive: true
    });

    const normalizePlans = (payload) => {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.data)) return payload.data;
        return [];
    };

    useEffect(() => {
        let isMounted = true;

        const resolvePermissions = async () => {
            if (!currentUser || currentUser.role === "ADMIN") {
                if (isMounted) setResolvedPermissions({});
                return;
            }

            const existingPermissions = extractAdminPermissions(currentUser);
            if (Object.keys(existingPermissions).length > 0) {
                if (isMounted) setResolvedPermissions(existingPermissions);
                return;
            }

            const roleId = extractAdminRoleId(currentUser);
            if (!roleId) {
                if (isMounted) setResolvedPermissions({});
                return;
            }

            try {
                const rolePermissions = await fetchAdminRolePermissions(roleId);
                if (isMounted) setResolvedPermissions(rolePermissions);
            } catch {
                if (isMounted) setResolvedPermissions({});
            }
        };

        resolvePermissions();
        return () => {
            isMounted = false;
        };
    }, [currentUser]);

    const subscriptionPermissionKey = "food::subscription_management::plans";
    const canCreatePlan = canPerformAdminPermissionAction(currentUser, resolvedPermissions, subscriptionPermissionKey, "create");
    const canEditPlan = canPerformAdminPermissionAction(currentUser, resolvedPermissions, subscriptionPermissionKey, "edit");
    const canDeletePlan = canPerformAdminPermissionAction(currentUser, resolvedPermissions, subscriptionPermissionKey, "delete");

    const fetchPlans = async () => {
        try {
            setLoading(true);
            const response = await adminAPI.getSubscriptionPlans({ 
                userType: activeTab,
                includeInactive: showInactive 
            });
            setPlans(normalizePlans(response.data));
        } catch (error) {
            setPlans([]);
            toast.error("Failed to fetch subscription plans");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPlans();
    }, [activeTab, showInactive]);

    // --- Subscription enforcement master switch (per partner type) ---
    const enforcementKey = activeTab === "RESTAURANT" ? "restaurant" : "deliveryPartner";

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const res = await adminAPI.getBusinessSettings();
                const value = res.data?.data?.subscriptionEnforcement;
                if (mounted && value) {
                    setEnforcement({
                        restaurant: value.restaurant !== false,
                        deliveryPartner: value.deliveryPartner !== false
                    });
                }
            } catch {
                // Keep the safe default (enforced) if settings can't be read.
            } finally {
                if (mounted) setEnforcementLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, []);

    const handleToggleEnforcement = async (nextValue) => {
        if (!canEditPlan) {
            toast.error("Permission denied");
            return;
        }
        const previous = enforcement;
        const updated = { ...enforcement, [enforcementKey]: nextValue };
        setEnforcement(updated); // optimistic
        setEnforcementSaving(true);
        try {
            await adminAPI.updateBusinessSettings({ subscriptionEnforcement: updated });
            // Refresh the app-wide settings cache so every panel picks it up.
            await loadBusinessSettings().catch(() => {});
            toast.success(
                nextValue
                    ? `Subscription is now required for ${activeTab === "RESTAURANT" ? "restaurants" : "delivery partners"}`
                    : `Subscription requirement removed for ${activeTab === "RESTAURANT" ? "restaurants" : "delivery partners"}`
            );
        } catch (error) {
            setEnforcement(previous); // rollback
            toast.error(error.response?.data?.message || "Failed to update subscription setting");
        } finally {
            setEnforcementSaving(false);
        }
    };

    const filteredPlans = useMemo(() => {
        return normalizePlans(plans).filter(plan => 
            plan.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
        );
    }, [plans, searchQuery]);

    const handleOpenModal = (plan = null) => {
        if (plan && !canEditPlan) {
            toast.error("You do not have permission to edit subscription plans");
            return;
        }
        if (!plan && !canCreatePlan) {
            toast.error("You do not have permission to create subscription plans");
            return;
        }
        if (plan) {
            setEditingPlan(plan);
            setFormData({
                name: plan.name,
                description: plan.description || "",
                price: plan.price,
                durationValue: plan.durationValue,
                durationUnit: plan.durationUnit,
                isActive: plan.isActive
            });
        } else {
            setEditingPlan(null);
            setFormData({
                name: "",
                description: "",
                price: "",
                durationValue: 1,
                durationUnit: "DAY",
                isActive: true
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const payload = {
                ...formData,
                userType: activeTab,
                price: Number(formData.price)
            };

            if (editingPlan) {
                await adminAPI.updateSubscriptionPlan(editingPlan._id, payload);
                toast.success("Plan updated successfully");
            } else {
                await adminAPI.createSubscriptionPlan(payload);
                toast.success("Plan created successfully");
            }
            setIsModalOpen(false);
            fetchPlans();
        } catch (error) {
            toast.error(error?.response?.data?.message || "Something went wrong");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!canDeletePlan) {
            toast.error("You do not have permission to delete subscription plans");
            return;
        }
        if (!window.confirm("Are you sure you want to delete this plan?")) return;
        try {
            await adminAPI.deleteSubscriptionPlan(id);
            toast.success("Plan deleted successfully");
            fetchPlans();
        } catch (error) {
            toast.error("Failed to delete plan");
        }
    };

    const toggleStatus = async (plan) => {
        if (!canEditPlan) {
            toast.error("You do not have permission to update subscription plans");
            return;
        }
        try {
            await adminAPI.updateSubscriptionPlan(plan._id, { isActive: !plan.isActive });
            toast.success(`Plan ${plan.isActive ? 'disabled' : 'enabled'} successfully`);
            fetchPlans();
        } catch (error) {
            toast.error("Failed to update status");
        }
    };

    // --- NEW SUBSCRIPTION BUSINESS OVERVIEW STATE & LOGIC ---
    const [overviewData, setOverviewData] = useState(null);
    const [overviewLoading, setOverviewLoading] = useState(true);
    
    const [analyticsData, setAnalyticsData] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(true);

    const [historyData, setHistoryData] = useState([]);
    const [historyPagination, setHistoryPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
    const [historyLoading, setHistoryLoading] = useState(true);

    const [searchParams, setSearchParams] = useSearchParams();
    
    // History filters synchronized with URL state
    const historyPage = parseInt(searchParams.get("page")) || 1;
    const historySearch = searchParams.get("search") || "";
    const historyUserType = searchParams.get("userType") || "All";
    const historyType = searchParams.get("type") || "All";
    const historyStatus = searchParams.get("status") || "All";
    const historyStartDate = searchParams.get("startDate") || "";
    const historyEndDate = searchParams.get("endDate") || "";

    const fetchOverview = async () => {
        try {
            setOverviewLoading(true);
            const response = await adminAPI.getSubscriptionOverview();
            if (response.data?.success && response.data?.data) {
                setOverviewData(response.data.data);
            }
        } catch (err) {
            console.error("Overview fetch error", err);
        } finally {
            setOverviewLoading(false);
        }
    };

    const fetchAnalytics = async () => {
        try {
            setAnalyticsLoading(true);
            const response = await adminAPI.getSubscriptionAnalytics();
            if (response.data?.success && response.data?.data) {
                setAnalyticsData(response.data.data);
            }
        } catch (err) {
            console.error("Analytics fetch error", err);
        } finally {
            setAnalyticsLoading(false);
        }
    };

    const fetchHistory = async () => {
        try {
            setHistoryLoading(true);
            const params = {
                page: historyPage,
                limit: 10,
                search: historySearch,
                userType: historyUserType,
                type: historyType,
                status: historyStatus,
                startDate: historyStartDate,
                endDate: historyEndDate
            };
            const response = await adminAPI.getSubscriptionHistory(params);
            if (response.data?.success && response.data?.data) {
                setHistoryData(response.data.data.transactions || []);
                setHistoryPagination(response.data.data.pagination || { page: 1, limit: 10, total: 0, pages: 1 });
            }
        } catch (err) {
            console.error("History fetch error", err);
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        fetchOverview();
        fetchAnalytics();
    }, []);

    useEffect(() => {
        fetchHistory();
    }, [historyPage, historySearch, historyUserType, historyType, historyStatus, historyStartDate, historyEndDate]);

    const updateFilter = (key, value) => {
        const newParams = new URLSearchParams(searchParams);
        if (value && value !== "All") {
            newParams.set(key, value);
        } else {
            newParams.delete(key);
        }
        newParams.set("page", "1");
        setSearchParams(newParams);
    };

    const handleClearFilters = () => {
        setSearchParams(new URLSearchParams());
    };

    const handleExportCSV = async () => {
        const toastId = toast.loading("Generating CSV export...");
        try {
            const params = {
                search: historySearch,
                userType: historyUserType,
                type: historyType,
                status: historyStatus,
                startDate: historyStartDate,
                endDate: historyEndDate,
                export: "true"
            };
            const response = await adminAPI.getSubscriptionHistory(params, { responseType: 'blob' });
            
            const blob = new Blob([response.data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `subscription_export_${dayjs().format('YYYY-MM-DD_HHmmss')}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success("CSV download started", { id: toastId });
        } catch (err) {
            toast.error("Failed to export CSV", { id: toastId });
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard!");
    };

    return (
        <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
            {/* Header */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Settings2 className="w-7 h-7 text-[#6412C6]" />
                        <span>Subscription Management</span>
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Manage plans for restaurants and delivery partners</p>
                </div>
                {canCreatePlan && (
                    <button 
                        onClick={() => handleOpenModal()}
                        className="bg-[#6412C6] hover:bg-[#4E0E9A] text-white px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Create New Plan</span>
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-slate-200 rounded-xl w-fit mb-6">
                <button
                    onClick={() => setActiveTab("RESTAURANT")}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "RESTAURANT" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                >
                    Restaurants
                </button>
                <button
                    onClick={() => setActiveTab("DELIVERY_PARTNER")}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "DELIVERY_PARTNER" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                >
                    Delivery Partners
                </button>
            </div>

            {/* Subscription requirement master switch (per partner type) */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-[#6412C6]" />
                        Require subscription for {activeTab === "RESTAURANT" ? "restaurants" : "delivery partners"}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                        {enforcementLoading ? (
                            "Loading current setting…"
                        ) : enforcement[enforcementKey] ? (
                            <>
                                <span className="font-semibold text-slate-700">ON</span> — current flow: a
                                {activeTab === "RESTAURANT" ? " restaurant" : " delivery partner"} needs an active plan
                                or a daily pass to go online and receive orders.
                            </>
                        ) : (
                            <>
                                <span className="font-semibold text-slate-700">OFF</span> — no subscription needed. They
                                control their own online status, and the subscription section is hidden from their panel.
                            </>
                        )}
                    </p>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={!!enforcement[enforcementKey]}
                    disabled={enforcementLoading || enforcementSaving || !canEditPlan}
                    onClick={() => handleToggleEnforcement(!enforcement[enforcementKey])}
                    title={!canEditPlan ? "You don't have permission to change this" : undefined}
                    className={`relative w-14 h-7 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                        enforcement[enforcementKey] ? "bg-[#6412C6]" : "bg-slate-300"
                    }`}
                >
                    <span
                        className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                            enforcement[enforcementKey] ? "translate-x-7" : "translate-x-0"
                        }`}
                    />
                </button>
            </div>

            {/* Existing Plans Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Selling Plans</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-2">{plans.filter(p => p.isActive).length}</h3>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Active Subscribers</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-2">
                        {overviewLoading ? <Loader2 className="w-5 h-5 animate-spin inline text-[#6412C6]" /> : overviewData?.activeSubscribers?.total || 0}
                    </h3>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Plan Types</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-2">Day, Week, Month</h3>
                </div>
            </div>

            {/* Plans List Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-10">
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text"
                            placeholder="Search by plan name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6412C6]/20 focus:border-[#6412C6] transition-all"
                        />
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowInactive(!showInactive)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                showInactive 
                                    ? 'bg-purple-50 text-[#6412C6] border border-purple-200' 
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <AlertCircle className="w-4 h-4" />
                            <span>{showInactive ? 'Hide Archived' : 'Show Archived'}</span>
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Plan Details</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pricing</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Duration</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="w-8 h-8 text-[#6412C6] animate-spin" />
                                            <p className="text-sm text-slate-500">Loading plans...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredPlans.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                                                <AlertCircle className="w-6 h-6 text-slate-400" />
                                            </div>
                                            <p className="text-sm text-slate-500 font-medium">No plans found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredPlans.map((plan) => (
                                    <tr key={plan._id} className={`hover:bg-slate-50/50 transition-colors group ${!plan.isActive ? 'opacity-60 bg-slate-50/30 grayscale-[0.3]' : ''}`}>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-900">{plan.name}</span>
                                                <span className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">{plan.description || 'No description'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-bold text-slate-900">₹{plan.price}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-medium text-slate-700">{plan.durationValue} {plan.durationUnit}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button 
                                                onClick={() => toggleStatus(plan)}
                                                disabled={!canEditPlan}
                                                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${plan.isActive ? 'bg-green-500' : 'bg-slate-300'}`}
                                            >
                                                <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${plan.isActive ? 'translate-x-5' : 'translate-x-1'}`} />
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {canEditPlan && (
                                                    <button 
                                                        onClick={() => handleOpenModal(plan)}
                                                        className="p-2 text-slate-400 hover:text-primary hover:bg-purple-50 rounded-lg transition-all"
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {canDeletePlan && (
                                                    <button 
                                                        onClick={() => handleDelete(plan._id)}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* DIVIDER */}
            <div className="my-10 border-t border-slate-200" />

            {/* SECTION: SUBSCRIPTION BUSINESS OVERVIEW */}
            <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="w-6 h-6 text-[#6412C6]" />
                    <span>Subscription Business Overview</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">Real-time revenue monitoring, active subscriber metrics, and daily pass accounting</p>
            </div>

            {/* Sub Overview Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {/* Total Revenue */}
                <div 
                    onClick={() => handleClearFilters()}
                    className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 active:scale-[0.98] group"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Revenue</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-2">
                                {overviewLoading ? <Loader2 className="w-5 h-5 animate-spin text-[#6412C6]" /> : `₹${overviewData?.totalRevenue || 0}`}
                            </h3>
                            <p className="text-[10px] text-slate-400 mt-1">All time collected</p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-purple-50 text-[#6412C6] transition-colors group-hover:bg-[#6412C6] group-hover:text-white">
                            <DollarSign className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                {/* Active Paid Users */}
                <div 
                    onClick={() => updateFilter("status", "active")}
                    className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 active:scale-[0.98] group"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Paid Users</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-2">
                                {overviewLoading ? <Loader2 className="w-5 h-5 animate-spin text-[#6412C6]" /> : overviewData?.activeSubscribers?.total || 0}
                            </h3>
                            <p className="text-[10px] text-slate-500 mt-1 font-medium">
                                {overviewData?.activeSubscribers?.restaurants || 0} Restaurants | {overviewData?.activeSubscribers?.deliveryPartners || 0} Delivery
                            </p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-purple-50 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                            <Activity className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                {/* Daily Pass Usage */}
                <div 
                    onClick={() => updateFilter("type", "DAILY_DEDUCTION")}
                    className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 active:scale-[0.98] group"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Daily Pass Count</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-2">
                                {overviewLoading ? <Loader2 className="w-5 h-5 animate-spin text-[#6412C6]" /> : overviewData?.oneDayPassCount || 0}
                            </h3>
                            <p className="text-[10px] text-red-500 mt-1 font-semibold">
                                Spend: ₹{overviewData?.oneDayPassSpend || 0} (Not counted in revenue)
                            </p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-purple-50 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                            <Truck className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                {/* Wallet Recharge Revenue */}
                <div 
                    onClick={() => updateFilter("type", "TOPUP")}
                    className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 active:scale-[0.98] group"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recharge Revenue</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-2">
                                {overviewLoading ? <Loader2 className="w-5 h-5 animate-spin text-[#6412C6]" /> : `₹${overviewData?.walletRechargeRevenue || 0}`}
                            </h3>
                            <p className="text-[10px] text-slate-400 mt-1">Wallet recharge payments</p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                            <CreditCard className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                {/* Recurring Plan Revenue */}
                <div 
                    onClick={() => updateFilter("type", "WEEKLY_SUBSCRIPTION")}
                    className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 active:scale-[0.98] group"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recurring Revenue</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-2">
                                {overviewLoading ? <Loader2 className="w-5 h-5 animate-spin text-[#6412C6]" /> : `₹${overviewData?.recurringPlanRevenue || 0}`}
                            </h3>
                            <p className="text-[10px] text-slate-400 mt-1">Weekly + Monthly plans</p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-purple-50 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                            <Code className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                {/* Expiring Soon */}
                <div 
                    onClick={() => updateFilter("status", "expiring")}
                    className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 active:scale-[0.98] group"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Expiring Soon</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-2">
                                {overviewLoading ? <Loader2 className="w-5 h-5 animate-spin text-[#6412C6]" /> : overviewData?.expiringSoon || 0}
                            </h3>
                            <p className="text-[10px] text-slate-400 mt-1">Expiring in next 3 days</p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600 transition-colors group-hover:bg-amber-600 group-hover:text-white">
                            <Clock className="w-5 h-5" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Recharts Analytics Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Collected Revenue Trend (Area Chart) */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm lg:col-span-2">
                    <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <span>Revenue & Recharge Trend (Last 30 Days)</span>
                    </h3>
                    <div className="h-[250px] w-full">
                        {analyticsLoading ? (
                            <div className="h-full flex items-center justify-center">
                                <Loader2 className="w-8 h-8 text-[#6412C6] animate-spin" />
                            </div>
                        ) : !analyticsData?.revenueTrend || analyticsData.revenueTrend.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-xs text-slate-400">
                                No trend data available
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <AreaChart data={analyticsData.revenueTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6412C6" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#6412C6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="date" tickFormatter={(d) => dayjs(d).format('DD MMM')} tick={{ fontSize: 10, fill: '#64748b' }} />
                                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                                    <ChartTooltip labelFormatter={(l) => dayjs(l).format('DD MMMM YYYY')} />
                                    <Area type="monotone" dataKey="revenue" name="Total Revenue" stroke="#6412C6" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* User Collected Split (Pie Chart) */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-4">Collected Split</h3>
                        <div className="h-[180px] w-full relative">
                            {analyticsLoading ? (
                                <div className="h-full flex items-center justify-center">
                                    <Loader2 className="w-8 h-8 text-[#6412C6] animate-spin" />
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Restaurants', value: analyticsData?.userSplit?.restaurant || 0 },
                                                { name: 'Delivery Partners', value: analyticsData?.userSplit?.deliveryPartner || 0 }
                                            ]}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={45}
                                            outerRadius={65}
                                            paddingAngle={4}
                                            dataKey="value"
                                        >
                                            <Cell fill="#6412C6" />
                                            <Cell fill="#0ea5e9" />
                                        </Pie>
                                        <ChartTooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 text-xs mt-4 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#6412C6]" />
                                <span className="text-slate-600 font-medium">Restaurants</span>
                            </div>
                            <span className="font-bold text-slate-900">₹{analyticsData?.userSplit?.restaurant || 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#0ea5e9]" />
                                <span className="text-slate-600 font-medium">Delivery Partners</span>
                            </div>
                            <span className="font-bold text-slate-900">₹{analyticsData?.userSplit?.deliveryPartner || 0}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* History Table Container */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Advanced Search & Filtering Controls */}
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-sm font-bold text-slate-800">Audit Ledger & Transaction Log</h3>
                            <p className="text-[10px] text-slate-500 mt-0.5">Real-time ledger updates and active direct subscription purchase records</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleClearFilters}
                                className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors border border-slate-200 rounded-lg bg-white shadow-sm"
                            >
                                Clear All Filters
                            </button>
                            <button
                                onClick={handleExportCSV}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6412C6] hover:bg-[#4E0E9A] text-white rounded-lg text-xs font-bold transition-all shadow-sm shadow-purple-100"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span>Export CSV</span>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                        {/* Search field */}
                        <div className="relative col-span-1 sm:col-span-2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by name, email, phone..."
                                value={historySearch}
                                onChange={(e) => updateFilter("search", e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#6412C6]/20 focus:border-[#6412C6] bg-white transition-all"
                            />
                        </div>

                        {/* User Type */}
                        <div>
                            <select
                                value={historyUserType}
                                onChange={(e) => updateFilter("userType", e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#6412C6]/20 bg-white cursor-pointer"
                            >
                                <option value="All">All Wallet Types</option>
                                <option value="RESTAURANT">Restaurant</option>
                                <option value="DELIVERY_PARTNER">Delivery Boy</option>
                            </select>
                        </div>

                        {/* Action Type */}
                        <div>
                            <select
                                value={historyType}
                                onChange={(e) => updateFilter("type", e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#6412C6]/20 bg-white cursor-pointer"
                            >
                                <option value="All">All Action Types</option>
                                <option value="TOPUP">Wallet Topup</option>
                                <option value="DAILY_DEDUCTION">One Day Pass</option>
                                <option value="WEEKLY_SUBSCRIPTION">Weekly Plan</option>
                                <option value="MONTHLY_SUBSCRIPTION">Monthly Plan</option>
                            </select>
                        </div>

                        {/* Plan Status */}
                        <div>
                            <select
                                value={historyStatus}
                                onChange={(e) => updateFilter("status", e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#6412C6]/20 bg-white cursor-pointer"
                            >
                                <option value="All">All Statuses</option>
                                <option value="Active">Active</option>
                                <option value="Grace">Grace Period</option>
                                <option value="Expired">Expired</option>
                                <option value="Cancelled">Cancelled</option>
                                <option value="expiring">Expiring Soon</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-100">
                        {/* Start Date */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 font-medium">Start Date:</span>
                            <input
                                type="date"
                                value={historyStartDate}
                                onChange={(e) => updateFilter("startDate", e.target.value)}
                                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#6412C6]/20 bg-white cursor-pointer"
                            />
                        </div>

                        {/* End Date */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 font-medium">End Date:</span>
                            <input
                                type="date"
                                value={historyEndDate}
                                onChange={(e) => updateFilter("endDate", e.target.value)}
                                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#6412C6]/20 bg-white cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                {/* History Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">User Details</th>
                                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Action / Type</th>
                                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Source</th>
                                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Trigger</th>
                                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Balance Diff</th>
                                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Method</th>
                                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tx / Payment ID</th>
                                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {historyLoading ? (
                                <tr>
                                    <td colSpan="10" className="px-5 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="w-8 h-8 text-[#6412C6] animate-spin" />
                                            <p className="text-sm text-slate-500">Loading audit history...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : historyData.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="px-5 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                                                <AlertCircle className="w-6 h-6 text-slate-400" />
                                            </div>
                                            <p className="text-sm text-slate-500 font-medium">No transaction records found matching your filters</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                historyData.map((item) => {
                                    const userSearchPath = item.userType === 'RESTAURANT'
                                        ? `/ecs/food/restaurants?search=${encodeURIComponent(item.userName || '')}`
                                        : `/ecs/food/delivery-partners?search=${encodeURIComponent(item.userName || '')}`;

                                    return (
                                        <tr key={item._id} className="hover:bg-slate-50/50 transition-colors">
                                            {/* Date */}
                                            <td className="px-5 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                                                {dayjs(item.purchaseDate).format('YYYY-MM-DD HH:mm')}
                                            </td>

                                            {/* User Details */}
                                            <td className="px-5 py-3.5">
                                                <div className="flex flex-col">
                                                    <a 
                                                        href={userSearchPath}
                                                        className="text-xs font-bold text-[#6412C6] hover:underline flex items-center gap-1"
                                                    >
                                                        <span>{item.userName || 'Unnamed'}</span>
                                                        <ArrowUpRight className="w-3 h-3" />
                                                    </a>
                                                    <span className="text-[10px] text-slate-500">{item.userEmail || item.userPhone || ''}</span>
                                                    <span className={`inline-block w-fit px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider mt-1 ${
                                                        item.userType === 'RESTAURANT' ? 'bg-purple-50 text-[#6412C6]' : 'bg-purple-50 text-primary'
                                                    }`}>
                                                        {item.userType === 'RESTAURANT' ? 'Restaurant' : 'Delivery boy'}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Plan Name */}
                                            <td className="px-5 py-3.5 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-bold text-slate-900">{item.planName}</span>
                                                    {item.isLegacyPricing && (
                                                        <span 
                                                            title="Pricing is estimated from linked plan details because no immutable snapshot was captured at purchase time."
                                                            className="inline-flex items-center px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 text-[8px] font-black uppercase tracking-wider cursor-help"
                                                        >
                                                            Legacy Price
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Source */}
                                            <td className="px-5 py-3.5 text-xs text-slate-600 font-medium">
                                                {item.subscriptionSource}
                                            </td>

                                            {/* Trigger */}
                                            <td className="px-5 py-3.5 text-xs text-slate-600 font-medium">
                                                {item.purchaseTrigger}
                                            </td>

                                            {/* Amount */}
                                            <td className="px-5 py-3.5">
                                                <span className={`text-xs font-bold ${
                                                    item.referenceType === 'DAY_PASS' ? 'text-slate-600' : 'text-emerald-600 font-black'
                                                }`}>
                                                    {item.referenceType === 'DAY_PASS' ? '-' : '+'}₹{item.amountPaid}
                                                </span>
                                            </td>

                                            {/* Bal Before/After */}
                                            <td className="px-5 py-3.5 text-[10px] text-slate-500 font-medium">
                                                {item.referenceType === 'DAY_PASS' || item.referenceType === 'TOPUP' ? (
                                                    <span>₹{item.beforeBalance} → ₹{item.afterBalance}</span>
                                                ) : (
                                                    <span className="italic text-slate-400">Direct Pay</span>
                                                )}
                                            </td>

                                            {/* Payment Method */}
                                            <td className="px-5 py-3.5 text-xs text-slate-600 font-medium">
                                                {item.paymentMethod}
                                            </td>

                                            {/* Transaction ID */}
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-1.5 group">
                                                    <span className="text-[10px] text-slate-500 font-mono select-all">
                                                        {item.transactionId ? `${item.transactionId.substring(0, 10)}...` : '--'}
                                                    </span>
                                                    {item.transactionId && (
                                                        <button 
                                                            onClick={() => copyToClipboard(item.transactionId)}
                                                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <Copy className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Status */}
                                            <td className="px-5 py-3.5 text-right">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                                    item.status === 'Active' ? 'bg-green-50 text-green-600' :
                                                    item.status === 'Grace' ? 'bg-amber-50 text-amber-600' :
                                                    item.status === 'Expired' ? 'bg-red-50 text-red-600' :
                                                    'bg-slate-100 text-slate-500'
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                                        item.status === 'Active' ? 'bg-green-500' :
                                                        item.status === 'Grace' ? 'bg-amber-500' :
                                                        item.status === 'Expired' ? 'bg-red-500' :
                                                        'bg-slate-400'
                                                    }`} />
                                                    <span>{item.status}</span>
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {historyPagination.pages > 1 && (
                    <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
                        <span className="text-xs text-slate-500">
                            Showing page <strong className="text-slate-700">{historyPage}</strong> of <strong className="text-slate-700">{historyPagination.pages}</strong> ({historyPagination.total} total records)
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={historyPage === 1}
                                onClick={() => updateFilter("page", (historyPage - 1).toString())}
                                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white shadow-sm"
                            >
                                Previous
                            </button>
                            <button
                                disabled={historyPage === historyPagination.pages}
                                onClick={() => updateFilter("page", (historyPage + 1).toString())}
                                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white shadow-sm"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
                    <DialogHeader className="px-6 pt-6 pb-4 bg-slate-50/50 border-b border-slate-100">
                        <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                                <Plus className="w-5 h-5 text-[#6412C6]" />
                            </div>
                            {editingPlan ? 'Edit Subscription Plan' : 'Create New Subscription Plan'}
                        </DialogTitle>
                    </DialogHeader>
                    
                    <form onSubmit={handleSubmit} className="p-6 space-y-5 bg-white">
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Plan Name</label>
                            <input 
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                placeholder="e.g. Premium Monthly"
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-[#6412C6]/10 focus:border-[#6412C6] transition-all placeholder:text-slate-400"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Description</label>
                            <textarea 
                                value={formData.description}
                                onChange={(e) => setFormData({...formData, description: e.target.value})}
                                placeholder="What's included in this plan? (e.g. Priority support, lower commissions)"
                                rows="3"
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-[#6412C6]/10 focus:border-[#6412C6] transition-all placeholder:text-slate-400 resize-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Price (₹)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
                                    <input 
                                        type="number"
                                        required
                                        min="0"
                                        value={formData.price}
                                        onChange={(e) => setFormData({...formData, price: e.target.value})}
                                        placeholder="0.00"
                                        className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-[#6412C6]/10 focus:border-[#6412C6] transition-all"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Duration Unit</label>
                                <div className="relative">
                                    <select 
                                        value={formData.durationUnit}
                                        onChange={(e) => setFormData({...formData, durationUnit: e.target.value})}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-[#6412C6]/10 focus:border-[#6412C6] transition-all appearance-none cursor-pointer"
                                    >
                                        {DURATION_UNITS.map(unit => (
                                            <option key={unit.value} value={unit.value}>{unit.label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Duration Value</label>
                                <input 
                                    type="number"
                                    required
                                    min="1"
                                    value={formData.durationValue}
                                    onChange={(e) => setFormData({...formData, durationValue: Number(e.target.value)})}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-[#6412C6]/10 focus:border-[#6412C6] transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Payment Behavior</label>
                                <div className={`h-[42px] px-4 rounded-xl text-[10px] font-black tracking-wider flex items-center justify-center border transition-colors ${
                                    formData.durationUnit === 'DAY' 
                                        ? 'bg-purple-50 text-primary border-purple-100' 
                                        : 'bg-purple-50 text-[#6412C6] border-purple-100'
                                }`}>
                                    {formData.durationUnit === 'DAY' ? 'ONE-TIME CHECKOUT' : 'RECURRING SUBSCRIPTION'}
                                </div>
                            </div>
                        </div>

                        <div className="pt-2">
                            <div 
                                onClick={() => setFormData({...formData, isActive: !formData.isActive})}
                                className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors group"
                            >
                                <button 
                                    type="button"
                                    className={`relative inline-flex h-5 w-10 shrink-0 items-center rounded-full transition-colors focus:outline-none ${formData.isActive ? 'bg-green-500' : 'bg-slate-300'}`}
                                >
                                    <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${formData.isActive ? 'translate-x-5' : 'translate-x-1'}`} />
                                </button>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-800">Set as Active</span>
                                    <span className="text-[10px] text-slate-500 font-medium">Allow users to subscribe to this plan immediately</span>
                                </div>
                            </div>
                            <div className="mt-3 flex items-start gap-2 text-[10px] text-slate-500 leading-relaxed italic">
                                <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                                <p>For Week/Month plans, changing the price will automatically generate a new Razorpay Plan to protect existing subscriptions.</p>
                            </div>
                        </div>

                        <DialogFooter className="pt-4 flex items-center gap-3 sm:justify-end border-t border-slate-100 -mx-6 px-6 -mb-6 pb-6 mt-6 bg-slate-50/50">
                            <button 
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors rounded-xl hover:bg-slate-100"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit"
                                disabled={isSubmitting}
                                className="bg-[#6412C6] hover:bg-[#4E0E9A] text-white px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 disabled:opacity-70 transition-all shadow-lg shadow-purple-200"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Processing...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        <span>{editingPlan ? 'Update Plan' : 'Create Plan'}</span>
                                    </>
                                )}
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
