import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@food/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@food/components/ui/select"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  ArrowUpRight,
  Clock,
  IndianRupee,
  Package,
  ShoppingBag,
  Star,
  TrendingUp,
  Wallet,
  CheckCircle2,
  XCircle,
  UtensilsCrossed,
  AlertTriangle,
} from "lucide-react"
import { restaurantAPI } from "@food/api"
import { cn } from "@food/utils/utils"
import RestaurantBentoGrid from "@food/components/restaurant/RestaurantBentoGrid"
import RestaurantNavbar from "@food/components/restaurant/RestaurantNavbar"

const INR = "\u20B9"

function formatCurrency(value) {
  return `${INR}${Number(value || 0).toLocaleString("en-IN")}`
}

function KpiCard({ title, value, subtitle, icon: Icon, trend, accent = "primary" }) {
  const accentClasses = {
    primary: "from-[#B80B3D]/10 to-[#66001D]/5 text-[#B80B3D]",
    green: "from-emerald-50 to-emerald-100/50 text-emerald-700",
    amber: "from-amber-50 to-amber-100/50 text-amber-700",
    blue: "from-blue-50 to-blue-100/50 text-blue-700",
    violet: "from-violet-50 to-violet-100/50 text-violet-700",
  }

  return (
    <Card className="border-0 shadow-sm ring-1 ring-gray-100 overflow-hidden h-full rounded-2xl hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {title}
            </p>
            <p className="mt-2 text-2xl md:text-3xl font-black text-gray-900 truncate">{value}</p>
            {subtitle && (
              <p className="mt-1 text-xs text-gray-500 font-medium">{subtitle}</p>
            )}
            {trend != null && (
              <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <TrendingUp className="h-3.5 w-3.5" />
                {trend}
              </p>
            )}
          </div>
          <div
            className={cn(
              "shrink-0 rounded-2xl p-3 bg-gradient-to-br",
              accentClasses[accent] || accentClasses.primary
            )}
          >
            <Icon className="h-5 w-5 md:h-6 md:w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const chartTooltipStyle = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
}

export default function RestaurantDashboard() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState("month")
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const res = await restaurantAPI.getDashboardStats({ period })
        if (!cancelled && res.data?.success) {
          setData(res.data.data)
        }
      } catch {
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [period])

  const kpis = data?.kpis || {}
  const orderPie = data?.orderStatusBreakdown || []
  const paymentPie = data?.paymentMethodBreakdown || []
  const revenueTrend = data?.revenueTrend || []
  const monthlyTrend = data?.monthlyTrend || []
  const topItems = data?.topItems || []
  const recentOrders = data?.recentOrders || []

  const periodLabel = useMemo(() => {
    switch (period) {
      case "today":
        return "Today"
      case "week":
        return "This week"
      case "month":
        return "This month"
      case "year":
        return "This year"
      default:
        return "Overall"
    }
  }, [period])

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50">
      <RestaurantNavbar />
      
      <div className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
        {/* Header Section */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#B80B3D]">
              Restaurant overview
            </p>
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 mt-1">
              {data?.restaurant?.name || "Dashboard"}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {periodLabel} performance ·{" "}
              <span
                className={cn(
                  "font-semibold",
                  data?.restaurant?.isOnline ? "text-emerald-600" : "text-gray-400"
                )}
              >
                {data?.restaurant?.isOnline ? "Online" : "Offline"}
              </span>
            </p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-full sm:w-[180px] rounded-xl border-gray-200 bg-white">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This week</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="year">This year</SelectItem>
              <SelectItem value="overall">Overall</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="min-h-[40vh] flex items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#B80B3D] border-t-transparent" />
              <p className="mt-4 text-sm font-medium text-gray-500">Loading your stats...</p>
            </div>
          </div>
        ) : (
          <>
            {/* KPIs Grid */}
            <RestaurantBentoGrid variant="dashboard-kpi">
              <KpiCard
                title="Total revenue"
                value={formatCurrency(kpis.totalRevenue)}
                subtitle={`${kpis.deliveredOrders || 0} delivered orders`}
                icon={IndianRupee}
                accent="primary"
              />
              <KpiCard
                title="Today's orders"
                value={kpis.todayOrders ?? 0}
                subtitle={`${kpis.pendingOrders || 0} pending · ${kpis.processingOrders || 0} processing`}
                icon={ShoppingBag}
                accent="blue"
              />
              <KpiCard
                title="Available balance"
                value={formatCurrency(kpis.availableBalance)}
                subtitle={`Cycle earnings ${formatCurrency(kpis.cycleEarnings)}`}
                icon={Wallet}
                accent="green"
              />
              <KpiCard
                title="Average rating"
                value={Number(kpis.averageRating || 0).toFixed(1)}
                subtitle={`${kpis.totalRatings || 0} reviews`}
                icon={Star}
                accent="amber"
              />
            </RestaurantBentoGrid>

            {/* Sub KPIs Grid */}
            <RestaurantBentoGrid variant="dashboard-kpi">
              <KpiCard
                title="Total orders"
                value={kpis.totalOrders ?? 0}
                subtitle={`${kpis.completionRate || 0}% completion rate`}
                icon={CheckCircle2}
                accent="green"
              />
              <KpiCard
                title="Avg order value"
                value={formatCurrency(kpis.averageOrderValue)}
                subtitle="Per delivered order"
                icon={TrendingUp}
                accent="violet"
              />
              <KpiCard
                title="Menu items"
                value={kpis.menuItems ?? 0}
                subtitle={`${kpis.activeMenuItems || 0} active · ${kpis.addons || 0} add-ons`}
                icon={UtensilsCrossed}
                accent="primary"
              />
              <KpiCard
                title="Cancelled"
                value={kpis.cancelledOrders ?? 0}
                subtitle={`${kpis.cancellationRate || 0}% cancellation rate`}
                icon={XCircle}
                accent="amber"
              />
            </RestaurantBentoGrid>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Main Revenue Chart */}
              <Card className="xl:col-span-8 border-0 shadow-sm ring-1 ring-gray-100 rounded-2xl overflow-hidden bg-white">
                <CardHeader className="pb-2 border-b border-gray-50">
                  <CardTitle className="text-lg font-bold text-gray-900">
                    Revenue Trend
                  </CardTitle>
                  <p className="text-xs text-gray-500">Daily revenue & orders (last 14 days)</p>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="h-72 sm:h-80 w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueTrend}>
                        <defs>
                          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#B80B3D" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#B80B3D" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={chartTooltipStyle} cursor={{ stroke: '#e5e7eb', strokeWidth: 1, strokeDasharray: '4 4' }} />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="#B80B3D"
                          strokeWidth={2}
                          fill="url(#revGrad)"
                          name="Revenue (₹)"
                          activeDot={{ r: 6, fill: '#B80B3D', stroke: '#fff', strokeWidth: 2 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="orders"
                          stroke="#64748b"
                          strokeWidth={2}
                          dot={false}
                          name="Orders"
                          yAxisId={0}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Order Status Pie Chart */}
              <Card className="xl:col-span-4 border-0 shadow-sm ring-1 ring-gray-100 rounded-2xl overflow-hidden bg-white">
                <CardHeader className="pb-2 border-b border-gray-50">
                  <CardTitle className="text-lg font-bold text-gray-900">
                    Order Status
                  </CardTitle>
                  <p className="text-xs text-gray-500">Donut breakdown · {periodLabel}</p>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="h-72 sm:h-80 w-full min-w-0 flex items-center justify-center">
                    {orderPie.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center">No order data</p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={orderPie}
                            dataKey="value"
                            nameKey="label"
                            innerRadius={70}
                            outerRadius={100}
                            paddingAngle={3}
                          >
                            {orderPie.map((entry, i) => (
                              <Cell key={i} fill={entry.color} stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={chartTooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bottom Grid for Items and Recent Orders */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Dishes */}
              <Card className="border-0 shadow-sm ring-1 ring-gray-100 rounded-2xl bg-white h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-gray-50">
                  <div>
                    <CardTitle className="text-lg font-bold text-gray-900">Top Dishes</CardTitle>
                    <p className="text-xs text-gray-500">Best sellers in selected period</p>
                  </div>
                  <Package className="h-5 w-5 text-[#B80B3D]" />
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  {topItems.length === 0 ? (
                    <p className="text-sm text-gray-500 py-8 text-center">No item data yet</p>
                  ) : (
                    topItems.map((item, idx) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3 hover:border-red-100 hover:bg-red-50/30 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#fdf2f5] text-xs font-black text-[#B80B3D]">
                            {idx + 1}
                          </span>
                          <span className="truncate text-sm font-semibold text-gray-900">
                            {item.name}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-gray-900">{item.orders} sold</p>
                          <p className="text-xs text-gray-500">{formatCurrency(item.revenue)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Recent Orders */}
              <Card className="border-0 shadow-sm ring-1 ring-gray-100 rounded-2xl bg-white h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-gray-50">
                  <div>
                    <CardTitle className="text-lg font-bold text-gray-900">Recent Orders</CardTitle>
                    <p className="text-xs text-gray-500">Latest activity from your outlet</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/food/restaurant/orders/all")}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#B80B3D] hover:underline"
                  >
                    View all
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  {recentOrders.length === 0 ? (
                    <p className="text-sm text-gray-500 py-8 text-center">No orders yet</p>
                  ) : (
                    recentOrders.map((order) => (
                      <button
                        key={order.orderId}
                        type="button"
                        onClick={() => navigate(`/food/restaurant/orders/${order.orderId}`)}
                        className="w-full flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3 text-left hover:border-red-100 hover:bg-red-50/30 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900">#{order.orderId}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {order.createdAt
                              ? new Date(order.createdAt).toLocaleString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-gray-900">
                            {formatCurrency(order.total)}
                          </p>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                            {String(order.status || "").replace(/_/g, " ")}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
            
            {/* Alerts / Complaints */}
            {(kpis.complaints || 0) > 0 && (
              <Card className="border-amber-200 bg-amber-50/80 shadow-none rounded-2xl">
                <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 md:p-5">
                  <AlertTriangle className="h-8 w-8 text-amber-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-amber-900 text-sm md:text-base">
                      {kpis.complaints} open complaint{kpis.complaints !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs md:text-sm text-amber-800/80 mt-0.5">Review customer issues in the feedback section to maintain your rating.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/food/restaurant/feedback?tab=complaints")}
                    className="shrink-0 w-full sm:w-auto rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-700 transition-colors"
                  >
                    View Issues
                  </button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}
