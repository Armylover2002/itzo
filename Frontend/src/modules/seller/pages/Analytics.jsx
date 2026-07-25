import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import Button from "@shared/components/ui/Button";
import {
  HiOutlineChartBar,
  HiOutlineArrowTrendingUp,
  HiOutlineUsers,
  HiOutlineShoppingBag,
  HiOutlineArrowUpRight,
  HiOutlineArrowDownRight,
  HiOutlineCalendarDays,
  HiOutlineFunnel,
  HiOutlineArrowDownTray,
  HiOutlineMapPin,
  HiOutlineClock,
  HiOutlineDevicePhoneMobile,
} from "react-icons/hi2";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";
import ShimmerButton from "@/components/ui/shimmer-button";
import Modal from "@shared/components/ui/Modal";
import { sellerApi } from "../services/sellerApi";
import { toast } from "sonner";


const Analytics = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState(null);
  const [timeRange, setTimeRange] = useState("Last 7 Days");
  const [activeTab, setActiveTab] = useState("Overview");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [chartRange, setChartRange] = useState("Daily");
  const hasFetchedOnce = useRef(false);

  useEffect(() => {
    const fetchAnalytics = async () => {
      const isInitialLoad = !hasFetchedOnce.current;
      if (isInitialLoad) {
        setLoading(true);
      }
      try {
        const response = await sellerApi.getStats(chartRange.toLowerCase());
        const raw = response?.data?.result ?? response?.data?.data ?? null;
        if (response?.data?.success && raw && typeof raw === "object") {
          setStatsData({
            overview: raw.overview ?? {},
            salesTrend: Array.isArray(raw.salesTrend) ? raw.salesTrend : [],
            categoryMix: Array.isArray(raw.categoryMix) ? raw.categoryMix : [],
            topProducts: Array.isArray(raw.topProducts) ? raw.topProducts : [],
            trafficSources: Array.isArray(raw.trafficSources) ? raw.trafficSources : [],
            insights: raw.insights ?? {},
          });
        } else if (response?.data?.success && raw) {
          setStatsData(raw);
        }
      } catch (error) {
        console.error("Analytics Fetch Error:", error);
        toast.error("Failed to load analytics data");
        setStatsData((prev) => prev ?? {
          overview: {},
          salesTrend: [],
          categoryMix: [],
          topProducts: [],
          trafficSources: [],
          insights: {},
        });
      } finally {
        if (isInitialLoad) {
          hasFetchedOnce.current = true;
        }
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [chartRange]);

  const stats = [
    {
      label: "Total Sales",
      value: statsData?.overview?.totalSales || "₹0",
      trend: statsData?.overview?.salesTrend || "0%",
      icon: HiOutlineArrowTrendingUp,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Total Orders",
      value: statsData?.overview?.totalOrders || "0",
      trend: statsData?.overview?.ordersTrend || "0%",
      icon: HiOutlineShoppingBag,
      color: "text-primary",
      bg: "bg-orange-50",
    },
    {
      label: "Avg Order Value",
      value: statsData?.overview?.avgOrderValue || "₹0",
      trend: "0%", // Trend for AOV can be added later
      icon: HiOutlineUsers,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Conversion Rate",
      value: statsData?.overview?.conversionRate || "0%",
      trend: "0%",
      icon: HiOutlineChartBar,
      color: "text-rose-600",
      bg: "bg-rose-50",
    },
  ];

  const salesTrendArr = statsData?.salesTrend ?? [];
  const hasNoData = !Number(statsData?.overview?.totalOrders) && (!salesTrendArr.length || salesTrendArr.every((d) => !d.sales));

  const handleDownloadReport = () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const escapeCsv = (v) => {
        const s = String(v ?? "").replace(/"/g, '""');
        return /[",\n\r]/.test(s) ? `"${s}"` : s;
      };
      const lines = [];
      lines.push("Analytics Report");
      lines.push(`Generated,${new Date().toISOString()}`);
      lines.push("");

      const ov = statsData?.overview ?? {};
      lines.push("Overview");
      lines.push("Metric,Value");
      ["Total Sales", "Total Orders", "Avg Order Value", "Conversion Rate"].forEach((label, i) => {
        const key = ["totalSales", "totalOrders", "avgOrderValue", "conversionRate"][i];
        lines.push(`${escapeCsv(label)},${escapeCsv(ov[key] ?? "—")}`);
      });
      lines.push("");

      const trend = statsData?.salesTrend ?? [];
      if (trend.length) {
        lines.push("Sales Trend");
        lines.push("Period,Sales,Traffic");
        trend.forEach((d) => {
          lines.push(`${escapeCsv(d.name)},${escapeCsv(d.sales)},${escapeCsv(d.traffic)}`);
        });
        lines.push("");
      }

      const top = statsData?.topProducts ?? [];
      if (top.length) {
        lines.push("Top Products");
        lines.push("Product,Sales,Revenue,Trend %");
        top.forEach((p) => {
          lines.push(`${escapeCsv(p.name)},${escapeCsv(p.sales)},${escapeCsv(p.revenue)},${escapeCsv(p.trend)}`);
        });
        lines.push("");
      }

      const cat = statsData?.categoryMix ?? [];
      if (cat.length) {
        lines.push("Category Mix");
        lines.push("Category,Volume");
        cat.forEach((c) => {
          lines.push(`${escapeCsv(c.subject)},${escapeCsv(c.A)}`);
        });
        lines.push("");
      }

      const traffic = statsData?.trafficSources ?? [];
      if (traffic.length) {
        lines.push("Traffic Sources");
        lines.push("Source,Value");
        traffic.forEach((t) => {
          lines.push(`${escapeCsv(t.name)},${escapeCsv(t.value)}`);
        });
      }

      const csvContent = lines.join("\n");
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analytics-report-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Report downloaded successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to download report");
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen font-black text-slate-600">LOADING ANALYTICS...</div>;
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-20 sm:pb-16">
      <BlurFade delay={0.1}>
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex flex-wrap items-center gap-2">
              Advanced Analytics
              <Badge
                variant="success"
                className="text-[9px] px-1.5 py-0 font-bold tracking-wider uppercase bg-emerald-100 text-emerald-700">
                Real-time Insights
              </Badge>
            </h1>
            <p className="text-slate-600 text-sm sm:text-base mt-0.5 font-medium">
              Detailed breakdown of your business performance and customer
              behavior.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 w-full sm:w-auto overflow-x-auto scrollbar-hide min-w-0">
              {["Overview", "Sales", "Customers"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm sm:text-xs font-bold transition-all whitespace-nowrap shrink-0",
                    activeTab === tab
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                      : "text-slate-600 hover:text-slate-700",
                  )}>
                  {tab}
                </button>
              ))}
            </div>
            <ShimmerButton
              onClick={handleDownloadReport}
              background="#FE5502"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 sm:px-5 rounded-lg text-xs sm:text-sm sm:text-xs font-bold text-white shadow-lg disabled:opacity-50 shrink-0 bg-primary-orange hover:bg-primary-hover active:bg-primary-dark transition-colors"
              disabled={isExporting}>
              <HiOutlineArrowDownTray className="h-4 w-4 shrink-0" />
              <span>{isExporting ? "DOWNLOADING..." : "DOWNLOAD REPORT"}</span>
            </ShimmerButton>
          </div>
        </div>
      </BlurFade>

      {/* Quick Stats Grid - show for all tabs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats
          .filter((_, i) => {
            if (activeTab === "Customers") return i === 0 || i === 1; // Total Sales, Total Orders only
            return true;
          })
          .map((stat, i) => (
          <BlurFade key={stat.label} delay={0.1 + i * 0.05}>
            <MagicCard
              className="border-none shadow-md overflow-hidden group bg-white p-0"
              gradientColor={
                stat.bg.includes("emerald")
                  ? "#ecfdf5"
                  : stat.bg.includes("indigo")
                    ? "#eef2ff"
                    : stat.bg.includes("amber")
                      ? "#fffbeb"
                      : "#fff1f2"
              }>
              <div className="p-6 relative z-10 flex items-start justify-between">
                <div>
                  <p className="text-xs font-black text-slate-600 uppercase tracking-widest">
                    {stat.label}
                  </p>
                  <h4 className="text-2xl font-black text-slate-900 mt-1 tracking-tight">
                    {stat.value}
                  </h4>
                  <div
                    className={cn(
                      "flex items-center mt-3 text-xs sm:text-sm font-black px-2 py-0.5 rounded-full w-fit",
                      stat.trend.startsWith("+")
                        ? "text-emerald-600 bg-emerald-50"
                        : "text-rose-600 bg-rose-50",
                    )}>
                    {stat.trend.startsWith("+") ? (
                      <HiOutlineArrowUpRight className="mr-0.5" />
                    ) : (
                      <HiOutlineArrowDownRight className="mr-0.5" />
                    )}
                    {stat.trend}
                    <span className="text-slate-600 ml-1 font-medium">
                      vs prev 7d
                    </span>
                  </div>
                </div>
                <div
                  className={cn(
                    "h-12 w-12 rounded-lg flex items-center justify-center shadow-inner",
                    stat.bg,
                    stat.color,
                  )}>
                  <stat.icon className="h-6 w-6 transition-transform group-hover:scale-125 duration-300" />
                </div>
              </div>
            </MagicCard>
          </BlurFade>
        ))}
      </div>

      {hasNoData && (activeTab === "Overview" || activeTab === "Sales") && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 flex items-center gap-3">
          <HiOutlineChartBar className="h-6 w-6 text-slate-600 shrink-0" />
          <p className="text-sm font-semibold text-slate-600">
            Sales report is connected. Data will appear here once you have orders.
          </p>
        </div>
      )}

      {(activeTab === "Overview" || activeTab === "Sales") && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sales Performance Chart */}
        <BlurFade delay={0.4} className="lg:col-span-2">
          <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl p-6 bg-white overflow-hidden group h-full">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Revenue & Trends
                </h3>
                <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">
                  Performance Insights
                </p>
              </div>
              <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                {["Daily", "Weekly", "Monthly"].map((range) => (
                  <button
                    key={range}
                    onClick={() => setChartRange(range)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                      chartRange === range
                        ? "bg-white text-primary shadow-sm"
                        : "text-slate-600 hover:text-slate-600",
                    )}>
                    {range}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[400px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={statsData?.salesTrend || []}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient
                      id="colorTraffic"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
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
                    tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700 }}
                    dx={-10}
                    tickFormatter={(value) => `₹${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      borderRadius: "20px",
                      border: "none",
                      boxShadow:
                        "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
                    }}
                    itemStyle={{ fontSize: "11px", fontWeight: 900 }}
                    cursor={{
                      stroke: "#3b82f6",
                      strokeWidth: 1,
                      strokeDasharray: "4 4",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#3b82f6"
                    strokeWidth={4}
                    fillOpacity={1}
                    fill="url(#colorSales)"
                  />
                  <Area
                    type="monotone"
                    dataKey="traffic"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fillOpacity={1}
                    fill="url(#colorTraffic)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </BlurFade>

        {/* Category Mix (Radar Chart) */}
        <BlurFade delay={0.5} className="lg:col-span-1">
          <Card className="border-none shadow-xl shadow-slate-200/50 rounded-lg p-6 bg-white flex flex-col items-center justify-center group h-full">
            <div className="w-full text-center mb-6">
              <h3 className="text-lg font-black text-slate-900">
                Category Mix
              </h3>
              <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                Inventory Distribution
              </p>
            </div>
            <div className="h-[350px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart
                  cx="50%"
                  cy="50%"
                  outerRadius="70%"
                  data={statsData?.categoryMix || []}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: "#64748b", fontSize: 10, fontWeight: 800 }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 150]}
                    tick={false}
                    axisLine={false}
                  />
                  <Radar
                    name="Volume"
                    dataKey="A"
                    stroke="#10b981"
                    strokeWidth={3}
                    fill="#10b981"
                    fillOpacity={0.15}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-2 w-full mt-4">
              {(statsData?.categoryMix || []).slice(0, 3).map((cat, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 p-3 rounded-lg flex flex-col items-center border border-slate-100/50">
                  <p className="text-[10px] font-black text-slate-900">
                    {cat.A}
                  </p>
                  <p className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase">
                    {cat.subject}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </BlurFade>
      </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Selling Products - Overview & Sales */}
        {(activeTab === "Overview" || activeTab === "Sales") && (
        <BlurFade delay={0.6}>
          <Card className="border-none shadow-xl shadow-slate-200/50 rounded-lg p-0 overflow-hidden bg-white">
            <div className="p-6 border-b border-slate-50">
              <h3 className="text-lg font-black text-slate-900">
                Top Performing Products
              </h3>
              <p className="text-xs text-slate-600 font-medium">
                Bestsellers by sales volume and revenue generation.
              </p>
            </div>
            <div className="divide-y divide-slate-50">
              {(statsData?.topProducts || []).map((product, i) => (
                <div
                  key={i}
                  onClick={() => {
                    setSelectedProduct(product);
                    setIsProductModalOpen(true);
                  }}
                  className="px-6 py-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors group cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 font-black text-xs group-hover:bg-primary group-hover:text-white transition-all">
                      {i + 1}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900">
                        {product.name}
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-600 font-bold">
                        {product.sales} units sold
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">
                      {product.revenue}
                    </p>
                    <div
                      className={cn(
                        "flex items-center justify-end text-[10px] font-black mt-0.5",
                        product.trend > 0
                          ? "text-emerald-600"
                          : "text-rose-600",
                      )}>
                      {product.trend > 0 ? (
                        <HiOutlineArrowUpRight className="h-3 w-3 mr-0.5" />
                      ) : (
                        <HiOutlineArrowDownRight className="h-3 w-3 mr-0.5" />
                      )}
                      {Math.abs(product.trend)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-slate-50/50 border-t border-slate-50 text-center">
              <button
                onClick={() => navigate("/seller/products")}
                className="text-xs font-black text-primary uppercase tracking-widest hover:underline">
                View All Products Analytics
              </button>
            </div>
          </Card>
        </BlurFade>
        )}

        {/* Traffic Sources & Customer Insights - Overview & Customers */}
        {(activeTab === "Overview" || activeTab === "Customers") && (
        <BlurFade delay={0.7}>
          <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl p-6 bg-white overflow-hidden group h-full">
            <div className="mb-8">
              <h3 className="text-lg font-black text-slate-900">
                New Customers
              </h3>
              <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">
                Traffic Origin Analysis
              </p>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="h-[250px] w-full md:w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statsData?.trafficSources || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={8}
                      dataKey="value">
                      {(statsData?.trafficSources || []).map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          strokeWidth={0}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "15px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                      }}
                      itemStyle={{ fontSize: "10px", fontWeight: 900 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full md:w-1/2 space-y-4">
                {(statsData?.trafficSources || []).map((source, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: source.color }}
                      />
                      <span className="text-xs font-bold text-slate-600">
                        {source.name}
                      </span>
                    </div>
                    <span className="text-xs font-black text-slate-900">
                      {((source.value / (statsData?.trafficSources?.reduce((a, b) => a + b.value, 0) || 1)) * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-4 border-t border-slate-50 pt-8">
              <div className="text-center">
                <div className="h-10 w-10 bg-orange-50 text-primary rounded-xl flex items-center justify-center mx-auto mb-2">
                  <HiOutlineMapPin className="h-5 w-5" />
                </div>
                <p className="text-[10px] font-black text-slate-900 tracking-tight">
                  {statsData?.insights?.topCity || "N/A"}
                </p>
                <p className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest">
                  Top City
                </p>
              </div>
              <div className="text-center">
                <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <HiOutlineClock className="h-5 w-5" />
                </div>
                <p className="text-[10px] font-black text-slate-900 tracking-tight">
                  {statsData?.insights?.peakTime || "N/A"}
                </p>
                <p className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest">
                  Peak Time
                </p>
              </div>
              <div className="text-center">
                <div className="h-10 w-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <HiOutlineDevicePhoneMobile className="h-5 w-5" />
                </div>
                <p className="text-[10px] font-black text-slate-900 tracking-tight">
                  {statsData?.insights?.topDevice || "N/A"}
                </p>
                <p className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest">
                  Top Device
                </p>
              </div>
            </div>
          </Card>
        </BlurFade>
        )}
      </div>
      {/* Product Detail Modal */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title="Product Insights">
        {selectedProduct && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
              <div className="h-16 w-16 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-600">
                <HiOutlineShoppingBag className="h-8 w-8" />
              </div>
              <div>
                <h3 className="font-black text-slate-900">
                  {selectedProduct.name}
                </h3>
                <p className="text-xs text-slate-600 font-bold uppercase tracking-widest mt-1">
                  Product ID: {selectedProduct._id || "N/A"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-emerald-50 rounded-2xl">
                <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                  Revenue
                </p>
                <p className="text-xl font-black text-emerald-900">
                  {selectedProduct.revenue}
                </p>
              </div>
              <div className="p-4 bg-orange-50 rounded-2xl">
                <p className="text-[10px] font-black text-orange-700 uppercase tracking-widest">
                  Units Sold
                </p>
                <p className="text-xl font-black text-orange-900">
                  {selectedProduct.sales}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-black text-slate-900 uppercase tracking-widest pl-1">
                Sales velocity
              </p>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-primary w-[75%]" />
              </div>
              <p className="text-[10px] text-slate-600 font-bold text-right pt-1">
                +{selectedProduct.trend}% faster than last week
              </p>
            </div>

            <Button
              onClick={() => setIsProductModalOpen(false)}
              className="w-full py-4 rounded-2xl font-black bg-primary-orange hover:bg-primary-hover active:bg-primary-dark text-white transition-colors">
              CLOSE DETAILS
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Analytics;
