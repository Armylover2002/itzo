import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "@shared/components/ui/Card";
import PageHeader from "@shared/components/ui/PageHeader";
import Badge from "@shared/components/ui/Badge";
import StatCard from "@shared/components/ui/StatCard";
import {
  IndianRupee,
  Truck,
  Package,
  TrendingUp,
  ShoppingBag,
  Clock,
  ArrowUpRight,
  Plus,
  Eye,
  FileText,
  Tag,
  BarChart2,
  Calendar,
  ChevronDown,
} from "lucide-react";
import {
  HiOutlineTruck,
  HiOutlineXMark,
  HiOutlineMapPin,
  HiOutlinePhone,
  HiOutlineBanknotes,
  HiOutlineChevronDown,
} from "react-icons/hi2";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import { sellerApi } from "../services/sellerApi";
import { toast } from "sonner";
import { useSellerOrders } from "../context/SellerOrdersContext";

const Dashboard = () => {
  const navigate = useNavigate();
  const {
    orders: ordersFromContext,
    ordersLoading,
    refreshOrders,
  } = useSellerOrders();
  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  // ── Date Range Filter State ──────────────────────────────────────────
  const [dateRange, setDateRange] = useState("daily");
  const [customDate, setCustomDate] = useState("");
  const [selectedDateLabel, setSelectedDateLabel] = useState(() => {
    return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  });
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
  const dateMenuRef = React.useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dateMenuRef.current && !dateMenuRef.current.contains(e.target)) {
        setIsDateMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRangeSelect = async (rangeKey, labelText) => {
    setDateRange(rangeKey);
    setSelectedDateLabel(labelText);
    setIsDateMenuOpen(false);
    try {
      setLoading(true);
      const statsRes = await sellerApi.getStats(rangeKey);
      if (statsRes.data.success) {
        setStatsData(statsRes.data.result);
        toast.success(`Performance filter updated: ${labelText}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update date range stats");
    } finally {
      setLoading(false);
    }
  };

  const handleCustomDateSelect = async (dateVal) => {
    if (!dateVal) return;
    setCustomDate(dateVal);
    const formattedLabel = new Date(dateVal).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    setSelectedDateLabel(formattedLabel);
    setDateRange("custom");
    setIsDateMenuOpen(false);
    try {
      setLoading(true);
      const statsRes = await sellerApi.getStats(`date:${dateVal}`);
      if (statsRes.data.success) {
        setStatsData(statsRes.data.result);
        toast.success(`Performance filter updated: ${formattedLabel}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update custom date stats");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const fetchStats = async () => {
      try {
        setLoading(true);
        const statsRes = await sellerApi.getStats(dateRange);
        if (cancelled) return;
        if (statsRes.data.success) setStatsData(statsRes.data.result);
      } catch (error) {
        if (!cancelled) {
          console.error("Dashboard Fetch Error:", error);
          toast.error("Failed to load dashboard data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchStats();
    return () => {
      cancelled = true;
    };
  }, []);

  const safeOrders = Array.isArray(ordersFromContext) ? ordersFromContext : [];
  const loadingOrStats = loading || ordersLoading;

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const revenueChartData = React.useMemo(() => {
    const raw = statsData?.salesTrend ?? statsData?.chartData ?? [];
    const arr = Array.isArray(raw) ? raw : [];
    if (arr.length > 0) {
      return arr.map((d) => ({
        name: d.name ?? d.date ?? "—",
        sales: Number(d.sales ?? d.revenue ?? d.total ?? 0) || 0,
      }));
    }
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return { name: dayNames[d.getDay()], sales: 0 };
    });
  }, [statsData?.salesTrend, statsData?.chartData]);
  const revenueMax = Math.max(1, ...revenueChartData.map((d) => d.sales));

  const stats = [
    {
      label: "Total Revenue",
      value: statsData?.overview?.totalSales || "₹0",
      change: "+12.5%",
      changeType: "increase",
      icon: IndianRupee,
      iconBg: "bg-emerald-100/80",
      iconColor: "text-emerald-700",
      cardBg: "bg-[#F0FDF4] border-emerald-200/60 hover:border-emerald-300/80 shadow-xs",
      description: "vs last month",
    },
    {
      label: "Total Orders",
      value: statsData?.overview?.totalOrders || "0",
      change: "+8.2%",
      changeType: "increase",
      icon: ShoppingBag,
      iconBg: "bg-sky-100/80",
      iconColor: "text-sky-700",
      cardBg: "bg-[#F0F9FF] border-sky-200/60 hover:border-sky-300/80 shadow-xs",
      description: "vs last month",
    },
    {
      label: "Avg Order Value",
      value: statsData?.overview?.avgOrderValue || "₹0",
      change: "+2",
      changeType: "increase",
      icon: Package,
      iconBg: "bg-purple-100/80",
      iconColor: "text-purple-700",
      cardBg: "bg-[#F5F3FF] border-purple-200/60 hover:border-purple-300/80 shadow-xs",
      description: "per order",
    },
    {
      label: "Pending Orders",
      value: safeOrders.filter((o) => o.status === "pending").length.toString(),
      change: "-3",
      changeType: "decrease",
      icon: Clock,
      iconBg: "bg-amber-100/80",
      iconColor: "text-amber-700",
      cardBg: "bg-[#FFFBEB] border-amber-200/60 hover:border-amber-300/80 shadow-xs",
      description: "need attention",
    },
  ];

  const quickActions = [
    {
      title: "Add Product",
      icon: Plus,
      path: "/seller/products/add",
      iconBg: "bg-red-50",
      iconColor: "text-[#E4313B]",
    },
    {
      title: "View Orders",
      icon: FileText,
      path: "/seller/orders",
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
    },
    {
      title: "Manage Products",
      icon: Tag,
      path: "/seller/products",
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-500",
    },
    {
      title: "View Earnings",
      icon: BarChart2,
      path: "/seller/earnings",
      iconBg: "bg-purple-50",
      iconColor: "text-purple-500",
    },
  ];

  const getStatusColor = (status) => {
    const s = (status || "").toLowerCase();
    switch (s) {
      case "pending":
        return "warning";
      case "processing":
      case "confirmed":
        return "info";
      case "packed":
        return "primary";
      case "shipped":
      case "out_for_delivery":
        return "secondary";
      case "delivered":
        return "success";
      case "cancelled":
        return "error";
      default:
        return "secondary";
    }
  };

  const resolveSellerReceivable = (order) => {
    const receivable = Number(order?.pricing?.receivable);
    if (Number.isFinite(receivable)) return receivable;

    const subtotal = Number(order?.pricing?.subtotal);
    const commission = Number(order?.pricing?.commission);
    const couponDiscount = Number(order?.pricing?.couponDiscount || 0);
    const packingFee = Number(order?.pricing?.packingFee || 0);
    if (Number.isFinite(subtotal) && Number.isFinite(commission)) {
      return subtotal - commission - Math.max(0, couponDiscount) + Math.max(0, packingFee);
    }

    const fallback = Number(order?.total ?? order?.pricing?.total);
    return Number.isFinite(fallback) ? fallback : 0;
  };

  const normalizeOrderForModal = (order) => {
    if (!order) return null;
    const addr = order.address;
    const addressStr = [
      addr?.line1 || addr?.address,
      addr?.line2,
      addr?.city,
      addr?.state,
      addr?.pincode || addr?.zipCode,
    ]
      .filter(Boolean)
      .join(", ");
    const items = (order.items || []).map((item) => ({
      name: item.name || item.productName || "Item",
      price:
        item.price ??
        (item.quantity
          ? Number(item.totalPrice ?? 0) / Number(item.quantity)
          : 0),
      qty: item.quantity ?? 1,
      image: item.image || "",
    }));
    return {
      id: order.orderId,
      customer: {
        name: order.customer?.name || "Customer",
        phone: order.customer?.phone || "",
      },
      address: addressStr || "—",
      items,
      total: resolveSellerReceivable(order),
      pricing: {
        subtotal: Number(order.pricing?.subtotal || 0),
        commission: Number(order.pricing?.commission || 0),
        packingFee: Number(order.pricing?.packingFee || 0),
        couponDiscount: Number(order.pricing?.couponDiscount || 0),
        productEarnings: Number(order.pricing?.productEarnings || 0),
        total: Number(order.pricing?.total || 0),
        receivable: resolveSellerReceivable(order),
      },
      status: order.status || "pending",
      payment:
        order.payment?.method === "cash" || order.payment?.method === "cod"
          ? "Cash on Delivery"
          : "Online Paid",
    };
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await sellerApi.updateOrderStatus(orderId, {
        status: newStatus.toLowerCase(),
      });
      toast.success(`Order status updated to ${newStatus}`);
      setSelectedOrder((prev) =>
        prev && prev.id === orderId ? { ...prev, status: newStatus } : prev,
      );
      if (typeof refreshOrders === "function") refreshOrders();
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error("Failed to update status");
    }
  };

  if (loadingOrStats) {
    return (
      <div className="flex items-center justify-center h-screen font-bold text-slate-600">
        Updating Dashboard...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-3 md:px-4 pb-24 max-w-7xl md:max-w-none mx-auto w-full relative">
      {/* Custom Header - Non-sticky */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 mb-1">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-[#1c1c1e] tracking-tight">
            Here's your store performance
          </h1>
          <p className="text-xs font-normal text-slate-500 mt-0.5">
            Track and grow your business effortlessly.
          </p>
        </div>
        <div className="relative self-start sm:self-auto" ref={dateMenuRef}>
          <button
            onClick={() => setIsDateMenuOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 active:scale-[0.98] transition-all"
          >
            <Calendar className="h-3.5 w-3.5 text-slate-500" strokeWidth={2} />
            {selectedDateLabel}
            <ChevronDown className={`h-3.5 w-3.5 text-slate-400 ml-1 transition-transform duration-200 ${isDateMenuOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
          </button>

          {/* Date Range Dropdown */}
          {isDateMenuOpen && (
            <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1.5 w-56 max-w-[calc(100vw-2rem)] bg-white border border-slate-200/80 rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="p-1.5 space-y-0.5">
                {[
                  { key: "daily", label: "Today", sublabel: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
                  { key: "weekly", label: "This Week", sublabel: "Last 7 days" },
                  { key: "monthly", label: "This Month", sublabel: "Last 30 days" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => handleRangeSelect(opt.key, opt.key === "daily" ? opt.sublabel : opt.label)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all ${
                      dateRange === opt.key
                        ? "bg-red-50 text-[#E4313B] font-semibold"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-xs font-medium">{opt.label}</span>
                    <span className={`text-[10px] ${dateRange === opt.key ? 'text-[#E4313B]/70' : 'text-slate-400'}`}>{opt.sublabel}</span>
                  </button>
                ))}
              </div>
              <div className="border-t border-slate-100 p-2.5">
                <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1.5 block">Custom Date</label>
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => handleCustomDateSelect(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 bg-slate-50/50 focus:outline-none focus:ring-1 focus:ring-[#E4313B]/30 focus:border-[#E4313B]/40 transition-all"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl md:max-w-none mx-auto w-full flex flex-col gap-4 sm:gap-5">
        {/* Stats Grid - Colored & Compact Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          {stats.map((stat) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              icon={stat.icon}
              trend={stat.change}
              trendDirection={stat.changeType === "increase" ? "up" : "down"}
              description={stat.description}
              color={stat.iconColor}
              bg={stat.iconBg}
              cardBg={stat.cardBg}
              compact={true}
            />
          ))}
        </div>

      {/* Grow your business Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-red-50/80 rounded-2xl p-3.5 sm:p-4 border border-red-100/90">
        <div className="flex items-center gap-3 sm:gap-3.5">
            <div className="flex bg-red-100 p-2 rounded-xl shrink-0">
                <TrendingUp className="h-4.5 w-4.5 text-red-500" strokeWidth={2} />
            </div>
            <div>
                <h3 className="text-xs sm:text-sm font-semibold text-[#1c1c1e] mb-0.5">Grow your business</h3>
                <p className="text-xs text-slate-600 font-medium">Add more products and boost your sales today!</p>
            </div>
        </div>
        <button 
          onClick={() => navigate('/seller/products/add')}
          className="bg-[#E4313B] text-white px-4 sm:px-4.5 py-2 sm:py-2.5 rounded-xl font-semibold text-xs hover:bg-[#D1252F] active:scale-[0.98] transition-all whitespace-nowrap flex items-center justify-center gap-1.5 shadow-xs w-full sm:w-auto"
        >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Add Product
        </button>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm sm:text-base font-semibold text-[#1c1c1e] mb-2.5 sm:mb-3 tracking-tight">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 lg:gap-4">
          {quickActions.map((action) => {
            return (
              <button
                key={action.title}
                onClick={() => navigate(action.path)}
                className="flex flex-row sm:flex-col items-center justify-start sm:justify-center gap-2.5 sm:gap-0 bg-white p-2.5 sm:p-3 rounded-xl sm:rounded-2xl shadow-xs border border-slate-100 hover:shadow-sm transition-all active:scale-[0.98] w-full"
              >
                <div className={cn("p-2 sm:p-2.5 rounded-lg sm:rounded-xl sm:mb-2 shrink-0", action.iconBg || "bg-red-50")}>
                  <action.icon className={cn("h-4 w-4 sm:h-4.5 sm:w-4.5", action.iconColor || "text-red-500")} strokeWidth={2} />
                </div>
                <span className="text-xs font-semibold text-slate-800 text-left sm:text-center leading-tight">
                  {action.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Revenue Chart */}
        <Card
          title="Revenue Overview"
          subtitle="Last 7 days performance"
          compact={true}
          className="lg:col-span-2">
          <div className="h-[180px] sm:h-[280px] min-h-[170px] w-full mt-1 sm:mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={revenueChartData}
                margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient
                    id="revenueGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 10, fontWeight: 600 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 10, fontWeight: 600 }}
                  tickFormatter={(value) =>
                    `₹${Number(value).toLocaleString()}`
                  }
                  domain={[0, revenueMax]}
                  allowDataOverflow
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    color: "#334155",
                    fontSize: "11px",
                  }}
                  formatter={(value) => [
                    `₹${Number(value).toLocaleString()}`,
                    "Revenue",
                  ]}
                  labelFormatter={(label) => `Day: ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                  isAnimationActive={true}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Product Performance */}
        <Card title="Top Categories" subtitle="Sales by category" compact={true}>
          <div className="h-[180px] sm:h-[280px] min-h-[170px] w-full mt-1 sm:mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statsData?.categoryMix || []} layout="vertical" margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 10 }}
                />
                <YAxis
                  type="category"
                  dataKey="subject"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 10 }}
                  width={65}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    color: "#334155",
                    fontSize: "11px",
                  }}
                />
                <Bar dataKey="A" fill="var(--primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card
        title="Recent Orders"
        subtitle="Latest transactions from your store"
        compact={true}
        headerAction={
          <button
            onClick={() => navigate("/seller/orders")}
            className="text-xs sm:text-sm font-semibold text-red-500 hover:text-red-600 flex items-center gap-1">
            View All
            <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        }>
        {/* Mobile View Card List */}
        <div className="block sm:hidden space-y-2">
          {safeOrders.slice(0, 5).map((order) => (
            <div 
              key={order.orderId}
              onClick={() => {
                setSelectedOrder(normalizeOrderForModal(order));
                setIsOrderModalOpen(true);
              }}
              className="p-2.5 bg-white rounded-lg border border-slate-100 shadow-2xs flex flex-col gap-1.5 active:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">#{order.orderId}</span>
                  <span className="text-[10px] text-slate-400 font-medium">• {new Date(order.createdAt).toLocaleDateString()}</span>
                </div>
                <Badge variant={getStatusColor(order.status)} className="capitalize text-[9px] px-1.5 py-0.2">
                  {order.status}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-100">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-600 shrink-0">
                    {order.customer?.name?.split(" ").map((n) => n[0]).join("") || "C"}
                  </div>
                  <span className="font-semibold text-slate-700 text-xs truncate">{order.customer?.name || "Customer"}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-extrabold text-slate-900 text-xs">₹{resolveSellerReceivable(order).toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedOrder(normalizeOrderForModal(order));
                      setIsOrderModalOpen(true);
                    }}
                    className="text-[11px] font-semibold text-red-500 hover:text-red-600 flex items-center gap-0.5"
                  >
                    View <Eye className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {safeOrders.length === 0 && (
            <p className="text-xs text-center text-slate-500 py-3">No recent orders</p>
          )}
        </div>

        {/* Desktop View Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="ds-table">
            <thead className="ds-table-header">
              <tr>
                <th className="ds-table-header-cell text-left">
                  Order ID
                </th>
                <th className="ds-table-header-cell text-left">
                  Customer
                </th>
                <th className="ds-table-header-cell text-left">
                  Date
                </th>
                <th className="ds-table-header-cell text-left">
                  Amount
                </th>
                <th className="ds-table-header-cell text-left">
                  Status
                </th>
                <th className="ds-table-header-cell text-center">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {safeOrders.slice(0, 5).map((order) => (
                <tr
                  key={order.orderId}
                  className="ds-table-row">
                  <td className="ds-table-cell font-semibold text-xs sm:text-sm">
                    {order.orderId}
                  </td>
                  <td className="ds-table-cell">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600">
                        {order.customer?.name
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("") || "C"}
                      </div>
                      <span className="font-semibold text-slate-700 text-xs sm:text-sm">
                        {order.customer?.name || "Customer"}
                      </span>
                    </div>
                  </td>
                  <td className="ds-table-cell text-xs sm:text-sm">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                  <td className="ds-table-cell font-semibold text-xs sm:text-sm">
                    ₹{resolveSellerReceivable(order).toFixed(2)}
                  </td>
                  <td className="ds-table-cell">
                    <Badge
                      variant={getStatusColor(order.status)}
                      className="capitalize text-xs">
                      {order.status}
                    </Badge>
                  </td>
                  <td className="ds-table-cell text-center">
                    <button
                      onClick={() => {
                        setSelectedOrder(normalizeOrderForModal(order));
                        setIsOrderModalOpen(true);
                      }}
                      className="text-slate-600 hover:text-red-500 transition-colors p-1">
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {safeOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-slate-600 text-xs sm:text-sm">
                    No recent orders
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      </div>

      <AnimatePresence>
        {isOrderModalOpen && selectedOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 lg:p-12">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-md"
              onClick={() => setIsOrderModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg sm:max-w-2xl relative z-10 bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
              {/* Modal Header - same as Orders */}
              <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className="h-9 w-9 sm:h-10 sm:w-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg shrink-0">
                    <HiOutlineTruck className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900">
                      Order Details
                    </h3>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <Badge
                        variant={getStatusColor(selectedOrder.status)}
                        className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0">
                        {selectedOrder.status}
                      </Badge>
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest truncate max-w-[120px] sm:max-w-none">
                        #{selectedOrder.id}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsOrderModalOpen(false)}
                  className="p-1.5 sm:p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
                  <HiOutlineXMark className="h-5 w-5" />
                </button>
              </div>

              <div className="px-4 py-4 sm:px-6 sm:py-5 overflow-y-auto scrollbar-hide flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <HiOutlineMapPin className="h-3 w-3 text-red-500" />{" "}
                        Delivery Address
                      </h4>
                      <p className="text-xs font-bold text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-sm">
                        {selectedOrder.address}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <HiOutlinePhone className="h-3 w-3 text-emerald-500" />{" "}
                        Customer Info
                      </h4>
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-sm">
                        <p className="text-xs font-bold text-slate-800">
                          {selectedOrder.customer.name}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 sm:space-y-4">
                    <div className="bg-red-500/5 p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-red-500/10">
                      <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-3">
                        Order Summary
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="font-bold text-slate-600">
                            Items subtotal
                          </span>
                          <span className="font-black text-slate-900">
                            ₹{(selectedOrder.pricing?.subtotal || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="font-bold text-slate-600">
                            Commission
                          </span>
                          <span className="font-black text-rose-600">
                            -₹{(selectedOrder.pricing?.commission || 0).toFixed(2)}
                          </span>
                        </div>
                        {Number(selectedOrder.pricing?.couponDiscount || 0) > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="font-bold text-slate-600">
                              Seller Coupon
                            </span>
                            <span className="font-black text-rose-600">
                              -₹{(selectedOrder.pricing?.couponDiscount || 0).toFixed(2)}
                            </span>
                          </div>
                        )}
                        {Number(selectedOrder.pricing?.packingFee || 0) > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="font-bold text-slate-600">
                              Packing Fee
                            </span>
                            <span className="font-black text-emerald-600">
                              +₹{(selectedOrder.pricing?.packingFee || 0).toFixed(2)}
                            </span>
                          </div>
                        )}
                        <div className="h-px bg-red-500/10 my-2" />
                        <div className="flex justify-between text-sm">
                          <span className="font-black text-slate-900">
                            Receivable
                          </span>
                          <span className={cn(
                            "font-black",
                            Number(selectedOrder.pricing?.receivable ?? selectedOrder.total ?? 0) < 0
                              ? "text-rose-600"
                              : "text-red-500",
                          )}>
                            ₹{Number(selectedOrder.pricing?.receivable ?? selectedOrder.total ?? 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-slate-900 p-3 sm:p-4 rounded-2xl sm:rounded-3xl text-white shadow-xl shadow-red-500/20">
                      <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-2">
                        Payment Status
                      </h4>
                      <div className="flex items-center gap-2">
                        <HiOutlineBanknotes className="h-5 w-5 text-emerald-400" />
                        <span className="text-xs font-bold tracking-tight">
                          {selectedOrder.payment}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-3 sm:mb-4">
                  Items Ordered ({selectedOrder.items.length})
                </h4>
                <div className="space-y-3 max-h-48 sm:max-h-64 overflow-y-auto pr-1">
                  {selectedOrder.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-white ring-1 ring-slate-100 rounded-2xl group hover:shadow-md transition-all">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl overflow-hidden bg-slate-50 ring-1 ring-slate-200 shrink-0">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-slate-600 text-xs font-bold">
                              —
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 line-clamp-1">
                            {item.name}
                          </p>
                          <p className="text-[10px] font-semibold text-slate-600 mt-0.5">
                            ₹{Number(item.price).toFixed(2)} × {item.qty}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-xs font-black text-slate-900">
                          ₹{(item.price * item.qty).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
                <button
                  onClick={() => setIsOrderModalOpen(false)}
                  className="px-5 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all">
                  CLOSE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
