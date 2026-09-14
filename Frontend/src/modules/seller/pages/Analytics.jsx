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
      label: "Net Sales",
      value: statsData?.overview?.totalSales || "₹0",
      trend: statsData?.overview?.salesTrend || "0%",
      icon: HiOutlineArrowTrendingUp,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50 border-emerald-200/80",
    },
    {
      label: "Total Orders",
      value: statsData?.overview?.totalOrders || "0",
      trend: statsData?.overview?.ordersTrend || "0%",
      icon: HiOutlineShoppingBag,
      iconColor: "text-red-600",
      iconBg: "bg-red-50 border-red-200/80",
    },
    {
      label: "Avg Order Value",
      value: statsData?.overview?.avgOrderValue || "₹0",
      trend: "0%", // Trend for AOV can be added later
      icon: HiOutlineUsers,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-50 border-amber-200/80",
    },
    {
      label: "Conversion Rate",
      value: statsData?.overview?.conversionRate || "0%",
      trend: "0%",
      icon: HiOutlineChartBar,
      iconColor: "text-purple-600",
      iconBg: "bg-purple-50 border-purple-200/80",
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
      ["Net Sales", "Total Orders", "Avg Order Value", "Conversion Rate"].forEach((label, i) => {
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
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
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
    return <div className="flex items-center justify-center h-screen font-semibold text-xs text-slate-500">Loading analytics...</div>;
  }

  return (
    <div className="space-y-4 px-3.5 md:px-4 max-w-5xl md:max-w-none mx-auto w-full pb-20">
      {/* Header Bar */}
      <BlurFade delay={0.1}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 mb-1">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-[#1c1c1e] tracking-tight flex items-center gap-2">
              Advanced Analytics
              <span className="text-[10px] px-2 py-0.5 font-medium uppercase tracking-wider rounded-md bg-emerald-100 text-emerald-700 border border-emerald-200">
                Real-time Insights
              </span>
            </h1>
            <p className="text-xs font-normal text-slate-500 mt-0.5">
              Detailed breakdown of your business performance and customer behavior.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60 shrink-0">
              {["Overview", "Sales", "Customers"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap cursor-pointer",
                    activeTab === tab
                      ? "bg-white text-[#1c1c1e] shadow-2xs font-semibold"
                      : "text-slate-600 hover:text-slate-900",
                  )}>
                  {tab}
                </button>
              ))}
            </div>
            <button
              onClick={handleDownloadReport}
              disabled={isExporting}
              className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50">
              <HiOutlineArrowDownTray className="h-3.5 w-3.5 text-white" />
              <span>{isExporting ? "Downloading..." : "Export Report"}</span>
            </button>
          </div>
        </div>
      </BlurFade>

      {/* 2-by-2 Pure White Stat Cards Grid with Colorful Icon Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5">
        {stats
          .filter((_, i) => {
            if (activeTab === "Customers") return i === 0 || i === 1; // Net Sales, Total Orders only
            return true;
          })
          .map((stat, i) => (
          <BlurFade key={stat.label} delay={0.1 + i * 0.05}>
            <div className="p-3 sm:p-3.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs relative overflow-hidden transition-all hover:border-slate-300">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider truncate">
                    {stat.label}
                  </p>
                  <h4 className="text-base sm:text-lg font-semibold text-[#1c1c1e] mt-0.5 tracking-tight truncate">
                    {stat.value}
                  </h4>
                </div>
                <div className={cn("h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 shadow-2xs", stat.iconBg)}>
                  <stat.icon className={cn("h-4 w-4", stat.iconColor)} />
                </div>
              </div>

              <div className="flex items-center gap-1 mt-1.5 text-[10px] font-medium">
                <span className={cn(
                  "inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold",
                  String(stat.trend || "").startsWith("+")
                    ? "text-emerald-700 bg-emerald-50 border border-emerald-200/60"
                    : "text-rose-700 bg-rose-50 border border-rose-200/60"
                )}>
                  {String(stat.trend || "").startsWith("+") ? (
                    <HiOutlineArrowUpRight className="mr-0.5 h-3 w-3" />
                  ) : (
                    <HiOutlineArrowDownRight className="mr-0.5 h-3 w-3" />
                  )}
                  {String(stat.trend || "0%")}
                </span>
                <span className="text-slate-500 font-normal">vs prev 7d</span>
              </div>
            </div>
          </BlurFade>
        ))}
      </div>

      {hasNoData && (activeTab === "Overview" || activeTab === "Sales") && (
        <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 flex items-center gap-2.5 text-xs shadow-2xs">
          <HiOutlineChartBar className="h-4 w-4 text-slate-500 shrink-0" />
          <p className="text-slate-600 font-normal">
            Sales report connected. Real-time data will populate here as new orders arrive.
          </p>
        </div>
      )}

      {(activeTab === "Overview" || activeTab === "Sales") && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {/* Sales Performance Chart */}
        <BlurFade delay={0.3} className="lg:col-span-2">
          <div className="border border-slate-200/80 shadow-2xs rounded-xl p-3.5 sm:p-4 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-[#1c1c1e]">
                  Revenue & Trends
                </h3>
                <p className="text-[10px] text-slate-500 font-normal">
                  Sales performance insights
                </p>
              </div>
              <div className="flex bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60">
                {["Daily", "Weekly", "Monthly"].map((range) => (
                  <button
                    key={range}
                    onClick={() => setChartRange(range)}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer",
                      chartRange === range
                        ? "bg-white text-red-600 shadow-2xs font-semibold"
                        : "text-slate-600 hover:text-slate-900",
                    )}>
                    {range}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[240px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={statsData?.salesTrend || []}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 10 }}
                    dy={5}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 10 }}
                    dx={-5}
                    tickFormatter={(value) => `₹${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      fontSize: "11px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#ef4444"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorSales)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </BlurFade>

        {/* Category Mix (Radar Chart) */}
        <BlurFade delay={0.4} className="lg:col-span-1">
          <div className="border border-slate-200/80 shadow-2xs rounded-xl p-3.5 sm:p-4 bg-white flex flex-col justify-between h-full space-y-2">
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-[#1c1c1e]">
                Category Mix
              </h3>
              <p className="text-[10px] text-slate-500 font-normal">
                Inventory distribution
              </p>
            </div>
            <div className="h-[180px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="65%" data={statsData?.categoryMix || []}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "#64748b", fontSize: 9 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                  <Radar name="Volume" dataKey="A" stroke="#ef4444" strokeWidth={2} fill="#ef4444" fillOpacity={0.15} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-1.5 w-full pt-1 border-t border-slate-100">
              {(statsData?.categoryMix || []).slice(0, 3).map((cat, idx) => (
                <div key={idx} className="bg-slate-50 p-1.5 rounded-md text-center border border-slate-100">
                  <p className="text-xs font-semibold text-slate-900">{cat.A}</p>
                  <p className="text-[9px] text-slate-500 font-normal uppercase truncate">{cat.subject}</p>
                </div>
              ))}
            </div>
          </div>
        </BlurFade>
      </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {/* Top Selling Products - Overview & Sales */}
        {(activeTab === "Overview" || activeTab === "Sales") && (
        <BlurFade delay={0.5}>
          <div className="border border-slate-200/80 shadow-2xs rounded-xl overflow-hidden bg-white">
            <div className="p-3.5 border-b border-slate-100">
              <h3 className="text-xs sm:text-sm font-semibold text-[#1c1c1e]">
                Top Performing Products
              </h3>
              <p className="text-[10px] text-slate-500 font-normal">
                Bestsellers by sales volume and revenue
              </p>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {(statsData?.topProducts || []).map((product, i) => (
                <div
                  key={i}
                  onClick={() => {
                    setSelectedProduct(product);
                    setIsProductModalOpen(true);
                  }}
                  className="px-3.5 py-2.5 flex items-center justify-between hover:bg-slate-50/70 transition-colors cursor-pointer">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-7 w-7 bg-slate-100 rounded-md flex items-center justify-center text-slate-700 font-semibold text-xs shrink-0">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-[#1c1c1e] truncate">
                        {product.name}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-normal">
                        {product.sales} units sold
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-slate-900">
                      {product.revenue}
                    </p>
                    <div className={cn(
                      "flex items-center justify-end text-[10px] font-medium mt-0.5",
                      product.trend > 0 ? "text-emerald-700" : "text-rose-700"
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
            <div className="p-2.5 bg-slate-50/50 border-t border-slate-100 text-center">
              <button
                onClick={() => navigate("/seller/products")}
                className="text-[11px] font-semibold text-red-600 hover:underline cursor-pointer">
                View All Products Analytics
              </button>
            </div>
          </div>
        </BlurFade>
        )}

        {/* Traffic Sources & Customer Insights - Overview & Customers */}
        {(activeTab === "Overview" || activeTab === "Customers") && (
        <BlurFade delay={0.6}>
          <div className="border border-slate-200/80 shadow-2xs rounded-xl p-3.5 sm:p-4 bg-white space-y-3">
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-[#1c1c1e]">
                New Customers & Traffic
              </h3>
              <p className="text-[10px] text-slate-500 font-normal">
                Traffic origin analysis
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="h-[150px] w-full sm:w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statsData?.trafficSources || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={6}
                      dataKey="value">
                      {(statsData?.trafficSources || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        fontSize: "10px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full sm:w-1/2 space-y-2 text-xs">
                {(statsData?.trafficSources || []).map((source, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: source.color }} />
                      <span className="text-[11px] font-medium text-slate-600">{source.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-900">
                      {((source.value / (statsData?.trafficSources?.reduce((a, b) => a + b.value, 0) || 1)) * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
              <div>
                <p className="text-xs font-semibold text-[#1c1c1e] truncate">
                  {statsData?.insights?.topCity || "N/A"}
                </p>
                <p className="text-[10px] text-slate-500 font-normal">Top City</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#1c1c1e] truncate">
                  {statsData?.insights?.peakTime || "N/A"}
                </p>
                <p className="text-[10px] text-slate-500 font-normal">Peak Time</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#1c1c1e] truncate">
                  {statsData?.insights?.topDevice || "N/A"}
                </p>
                <p className="text-[10px] text-slate-500 font-normal">Top Device</p>
              </div>
            </div>
          </div>
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
              <div className="p-4 bg-red-50 rounded-2xl">
                <p className="text-[10px] font-black text-red-700 uppercase tracking-widest">
                  Units Sold
                </p>
                <p className="text-xl font-black text-red-900">
                  {selectedProduct.sales}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-black text-slate-900 uppercase tracking-widest pl-1">
                Sales velocity
              </p>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 w-[75%]" />
              </div>
              <p className="text-[10px] text-slate-600 font-bold text-right pt-1">
                +{selectedProduct.trend}% faster than last week
              </p>
            </div>

            <Button
              onClick={() => setIsProductModalOpen(false)}
              className="w-full py-4 rounded-2xl font-black shadow-xl shadow-red-500/20">
              CLOSE DETAILS
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Analytics;
