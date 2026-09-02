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
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Activity, ArrowUpRight, ShoppingBag, CreditCard, Truck, Receipt, DollarSign, Store, UserCheck, Package, UserCircle, Clock, CheckCircle, Plus, XCircle } from "lucide-react"
import { adminAPI } from "@food/api"
import { useAuth } from "@core/context/AuthContext"
import { getCurrentUser } from "@food/utils/auth"
import { canAccessAdminPath, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions"
const debugLog = () => {}
const debugError = () => {}

const INR_SYMBOL = "\u20B9"

function formatCurrency(amount, options = {}) {
  const numericAmount = Number(amount || 0)
  const formattedAmount = numericAmount.toLocaleString("en-IN", options)
  return `${INR_SYMBOL}${formattedAmount}`
}


export default function AdminHome() {
  const navigate = useNavigate()
  const { user: authUser } = useAuth()
  const user = useMemo(() => authUser || getCurrentUser("admin"), [authUser])
  const [selectedZone, setSelectedZone] = useState("all")
  const [selectedPeriod, setSelectedPeriod] = useState("overall")
  const [isLoading, setIsLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState(null)
  const [zones, setZones] = useState([])
  const [subOverview, setSubOverview] = useState(null)
  const [resolvedPermissions, setResolvedPermissions] = useState({})

  useEffect(() => {
    let isMounted = true

    const resolvePermissions = async () => {
      if (!user || user.role === "ADMIN") {
        if (isMounted) setResolvedPermissions({})
        return
      }

      const existingPermissions = extractAdminPermissions(user)
      if (Object.keys(existingPermissions).length > 0) {
        if (isMounted) setResolvedPermissions(existingPermissions)
        return
      }

      const roleId = extractAdminRoleId(user)
      if (!roleId) {
        if (isMounted) setResolvedPermissions({})
        return
      }

      try {
        const rolePermissions = await fetchAdminRolePermissions(roleId)
        if (isMounted) setResolvedPermissions(rolePermissions)
      } catch {
        if (isMounted) setResolvedPermissions({})
      }
    }

    resolvePermissions()
    return () => {
      isMounted = false
    }
  }, [user])

  const canAccessPath = (path) => canAccessAdminPath(user, resolvedPermissions, path)

  useEffect(() => {
    const fetchSubOverview = async () => {
      try {
        const response = await adminAPI.getSubscriptionOverview()
        if (response.data?.success && response.data?.data) {
          setSubOverview(response.data.data)
        }
      } catch (err) {
        // debugError
      }
    }
    fetchSubOverview()
  }, [])

  // Fetch zone list for filter
  useEffect(() => {
    const fetchZones = async () => {
      try {
        const response = await adminAPI.getZones({ page: 1, limit: 1000 })
        const list = response?.data?.data?.zones || []
        setZones(Array.isArray(list) ? list : [])
      } catch (error) {
        debugError("Error fetching zones:", error)
        setZones([])
      }
    }

    fetchZones()
  }, [])

  // Fetch dashboard stats from backend when filters change
  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        setIsLoading(true)
        const params = {
          period: selectedPeriod,
          ...(selectedZone !== "all" ? { zoneId: selectedZone } : {}),
        }
        const response = await adminAPI.getDashboardStats(params)
        if (response.data?.success && response.data?.data) {
          setDashboardData(response.data.data)
          debugLog("Dashboard stats fetched:", response.data.data)
        } else {
          setDashboardData(null)
          debugError("Invalid dashboard response format:", response.data)
        }
      } catch (error) {
        setDashboardData(null)
        debugError("Error fetching dashboard stats:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardStats()
  }, [selectedZone, selectedPeriod])

  // Get order stats from real data
  const getOrderStats = () => {
    if (!dashboardData?.orders?.byStatus) {
      return [
        { label: "Delivered", value: 0, color: "#0ea5e9" },
        { label: "Cancelled", value: 0, color: "#ef4444" },
        { label: "Refunded", value: 0, color: "#f59e0b" },
        { label: "Pending", value: 0, color: "#10b981" },
      ]
    }

    const byStatus = dashboardData.orders.byStatus
    return [
      { label: "Delivered", value: byStatus.delivered || 0, color: "#0ea5e9" },
      { label: "Processing", value: byStatus.processing || 0, color: "#a855f7" },
      { label: "Cancelled", value: byStatus.cancelled || 0, color: "#ef4444" },
      { label: "Pending", value: byStatus.pending || 0, color: "#10b981" },
    ]
  }

  // Get monthly data from real data
  const getMonthlyData = () => {
    if (!dashboardData?.monthlyData || dashboardData.monthlyData.length === 0) {
      // Return empty data structure if no data
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      return monthNames.map(month => ({ month, commission: 0, revenue: 0, orders: 0 }))
    }

    // Use real monthly data from backend
    return dashboardData.monthlyData.map(item => ({
      month: item.month,
      commission: item.commission || 0,
      revenue: item.revenue || 0,
      orders: item.orders || 0
    }))
  }

  const orderStats = getOrderStats()
  const monthlyData = getMonthlyData()

  // Calculate totals from real data
  const revenueTotal = dashboardData?.revenue?.total || 0
  const ordersTotal = dashboardData?.orders?.total || 0
  const platformFeeTotal = dashboardData?.platformFee?.total || 0
  const deliveryFeeTotal = dashboardData?.deliveryFee?.total || 0
  const gstTotal = dashboardData?.gst?.total || 0
  const totalAdminEarnings = dashboardData?.totalAdminEarnings || 0

  // Additional stats
  const totalRestaurants = dashboardData?.restaurants?.total || 0
  const pendingRestaurantRequests = dashboardData?.restaurants?.pendingRequests || 0
  const totalDeliveryBoys = dashboardData?.deliveryBoys?.total || 0
  const pendingDeliveryBoyRequests = dashboardData?.deliveryBoys?.pendingRequests || 0
  const totalFoods = dashboardData?.foods?.total || 0
  const totalAddons = dashboardData?.addons?.total || 0
  const totalCustomers = dashboardData?.customers?.total || 0
  const pendingOrders = dashboardData?.orderStats?.pending || 0
  const processingOrders = dashboardData?.orderStats?.processing || 0
  const completedOrders = dashboardData?.orderStats?.completed || 0
  const activeOrdersTotal = processingOrders

  const pieData = orderStats.map((item) => ({
    name: item.label,
    value: item.value,
    fill: item.color,
  }))

  const deliveryProfit = dashboardData?.deliveryProfit || 0
  const periodLabel = selectedPeriod === "overall" ? "Overall" : 
                    selectedPeriod === "today" ? "Today's" : 
                    `This ${selectedPeriod}'s`

  const activityFeed = dashboardData?.liveSignals || []
  const totalRevenueHelper = [
    `Platform: ${formatCurrency(platformFeeTotal)}`,
    `Delivery Net: ${formatCurrency(deliveryProfit)}`,
    `GST: ${formatCurrency(gstTotal)}`,
  ].join(" + ")

  return (
    <div className="px-4 pb-10 lg:px-6 pt-4">
      <div className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-[0_30px_120px_-60px_rgba(0,0,0,0.28)]">
        {isLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-sm">
            <div className="flex items-center gap-3 rounded-full bg-white px-4 py-2 text-sm text-neutral-700 ring-1 ring-neutral-200">
              <span className="h-3 w-3 animate-ping rounded-full bg-neutral-800/70" />
              Updating metrics...
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 border-b border-neutral-200 bg-linear-to-br from-white via-neutral-50 to-neutral-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">ECS Overview</p>
              <h1 className="text-2xl font-semibold text-neutral-900">Operations Command</h1>
            </div>

          </div>
          <div className="flex flex-wrap gap-3">
            <Select value={selectedZone} onValueChange={setSelectedZone}>
              <SelectTrigger className="min-w-[160px] border-neutral-300 bg-white text-neutral-900">
                <SelectValue placeholder="All zones" />
              </SelectTrigger>
              <SelectContent className="border-neutral-200 bg-white text-neutral-900">
                <SelectItem value="all">All zones</SelectItem>
                {zones.map((zone) => (
                  <SelectItem key={zone._id} value={zone._id}>
                    {zone.zoneName || zone.name || "Unnamed Zone"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="min-w-[140px] border-neutral-300 bg-white text-neutral-900">
                <SelectValue placeholder="Overall" />
              </SelectTrigger>
              <SelectContent className="border-neutral-200 bg-white text-neutral-900">
                <SelectItem value="overall">Overall</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This week</SelectItem>
                <SelectItem value="month">This month</SelectItem>
                <SelectItem value="year">This year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Net revenue"
              value={formatCurrency(revenueTotal)}
              helper={`${periodLabel} transaction volume`}
              icon={<ShoppingBag className="h-5 w-5 text-emerald-600" />}
              accent="bg-emerald-200/40"
              path="/ecs/food/transaction-report"
            />
            <MetricCard
              title="Orders processed"
              value={activeOrdersTotal.toLocaleString("en-IN")}
              helper="Orders currently being processed"
              icon={<Activity className="h-5 w-5 text-amber-600" />}
              accent="bg-amber-200/40"
              path="/ecs/food/orders/processing"
            />
            <MetricCard
              title="Platform fee"
              value={formatCurrency(platformFeeTotal)}
              helper={`Platform service fees: ${periodLabel}`}
              icon={<CreditCard className="h-5 w-5 text-primary" />}
              accent="bg-orange-200/40"
              path="/ecs/food/fee-settings"
            />
            <MetricCard
              title="Delivery fee"
              value={formatCurrency(deliveryFeeTotal)}
              helper={`Total delivery fees: ${periodLabel}`}
              icon={<Truck className="h-5 w-5 text-primary" />}
              accent="bg-orange-200/40"
              path="/ecs/food/transaction-report"
            />
            <MetricCard
              title="GST"
              value={formatCurrency(gstTotal)}
              helper={`Total tax collected: ${periodLabel}`}
              icon={<Receipt className="h-5 w-5 text-orange-600" />}
              accent="bg-orange-200/40"
              path="/ecs/food/tax-report"
            />
            <MetricCard
              title="Platform Total"
              value={formatCurrency(totalAdminEarnings, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              helper={totalRevenueHelper}
              icon={<DollarSign className="h-5 w-5 text-green-600" />}
              accent="bg-green-200/40"
              path="/ecs/food/transaction-report"
            />
            <MetricCard
              title="Total restaurants"
              value={totalRestaurants.toLocaleString("en-IN")}
              helper="Approved restaurants"
              icon={<Store className="h-5 w-5 text-primary" />}
              accent="bg-orange-200/40"
              path="/ecs/food/restaurants"
            />
            <MetricCard
              title="Restaurant request pending"
              value={pendingRestaurantRequests.toLocaleString("en-IN")}
              helper="Awaiting approval"
              icon={<UserCheck className="h-5 w-5 text-orange-600" />}
              accent="bg-orange-200/40"
              path="/ecs/food/restaurants/joining-request"
            />
            <MetricCard
              title="Total delivery boy"
              value={totalDeliveryBoys.toLocaleString("en-IN")}
              helper="Approved delivery partners"
              icon={<Truck className="h-5 w-5 text-primary" />}
              accent="bg-orange-200/40"
              path="/ecs/food/delivery-partners"
            />
            <MetricCard
              title="Delivery boy request pending"
              value={pendingDeliveryBoyRequests.toLocaleString("en-IN")}
              helper="Awaiting verification"
              icon={<Clock className="h-5 w-5 text-yellow-600" />}
              accent="bg-yellow-200/40"
              path="/ecs/food/delivery-partners/join-request"
            />
            <MetricCard
              title="Total foods"
              value={totalFoods.toLocaleString("en-IN")}
              helper="Approved menu items"
              icon={<Package className="h-5 w-5 text-primary" />}
              accent="bg-orange-200/40"
              path="/ecs/food/foods"
            />
            <MetricCard
              title="Total addons"
              value={totalAddons.toLocaleString("en-IN")}
              helper="Approved addon items"
              icon={<Plus className="h-5 w-5 text-pink-600" />}
              accent="bg-pink-200/40"
              path="/ecs/food/addons"
            />
            <MetricCard
              title="Total customers"
              value={totalCustomers.toLocaleString("en-IN")}
              helper="Registered users"
              icon={<UserCircle className="h-5 w-5 text-primary" />}
              accent="bg-orange-200/40"
              path="/ecs/food/customers"
            />
            <MetricCard
              title="Pending orders"
              value={pendingOrders.toLocaleString("en-IN")}
              helper="Orders awaiting processing"
              icon={<Clock className="h-5 w-5 text-red-600" />}
              accent="bg-red-200/40"
              path="/ecs/food/orders/pending"
            />
            <MetricCard
              title="Completed orders"
              value={completedOrders.toLocaleString("en-IN")}
              helper="Successfully delivered"
              icon={<CheckCircle className="h-5 w-5 text-emerald-600" />}
              accent="bg-emerald-200/40"
              path="/ecs/food/orders/delivered"
            />
          </div>

          {/* Subscription Operations Section */}
          <div className="pt-4 border-t border-neutral-200/60 mt-6">
            <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-4">Subscription Operations Command</h3>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <MetricCard
                title="Net revenue"
                value={formatCurrency(subOverview?.totalRevenue || 0)}
                helper="Gross collected all-time"
                icon={<DollarSign className="h-5 w-5 text-[#6412C6]" />}
                accent="bg-orange-100/40"
                path="/ecs/food/subscriptions?source=revenue"
              />
              <MetricCard
                title="Active paid users"
                value={`${subOverview?.activeSubscribers?.total || 0} (${subOverview?.activeSubscribers?.restaurants || 0} R / ${subOverview?.activeSubscribers?.deliveryPartners || 0} D)`}
                helper="Active subscription plans"
                icon={<Activity className="h-5 w-5 text-primary" />}
                accent="bg-orange-100/40"
                path="/ecs/food/subscriptions?status=active"
              />
              <MetricCard
                title="Daily pass count"
                value={(subOverview?.oneDayPassCount || 0).toLocaleString("en-IN")}
                helper="One day passes activated"
                icon={<Truck className="h-5 w-5 text-primary" />}
                accent="bg-orange-100/40"
                path="/ecs/food/subscriptions?type=DAILY_DEDUCTION"
              />
              <MetricCard
                title="Recharge revenue"
                value={formatCurrency(subOverview?.walletRechargeRevenue || 0)}
                helper="Wallet topup volume"
                icon={<CreditCard className="h-5 w-5 text-emerald-600" />}
                accent="bg-emerald-100/40"
                path="/ecs/food/subscriptions?type=TOPUP"
              />
              <MetricCard
                title="Recurring plans"
                value={formatCurrency(subOverview?.recurringPlanRevenue || 0)}
                helper="Weekly & Monthly direct plans"
                icon={<Package className="h-5 w-5 text-primary" />}
                accent="bg-orange-100/40"
                path="/ecs/food/subscriptions?type=WEEKLY_SUBSCRIPTION"
              />
              <MetricCard
                title="Expiring soon"
                value={(subOverview?.expiringSoon || 0).toLocaleString("en-IN")}
                helper="Plans expiring within 3 days"
                icon={<Clock className="h-5 w-5 text-amber-600" />}
                accent="bg-amber-100/40"
                path="/ecs/food/subscriptions?status=expiring"
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2 min-w-0 border-neutral-200 bg-white">
              <CardHeader className="flex flex-col gap-2 border-b border-neutral-200 pb-4">
                <CardTitle className="text-lg text-neutral-900">Revenue trajectory</CardTitle>
                <p className="text-sm text-neutral-500">
                  Commission and net revenue with monthly order volume
                </p>
              </CardHeader>
              <CardContent className="min-w-0 pt-4">
                <div className="h-80 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <AreaChart data={monthlyData}>
                      <defs>
                        <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" stroke="#6b7280" />
                      <YAxis stroke="#6b7280" />
                      <Tooltip
                        contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12 }}
                        labelStyle={{ color: "#111827" }}
                        itemStyle={{ color: "#111827" }}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#0ea5e9"
                        fillOpacity={1}
                        fill="url(#revFill)"
                        name="Net revenue"
                      />
                      <Bar
                        dataKey="orders"
                        fill="#ef4444"
                        radius={[6, 6, 0, 0]}
                        name="Orders"
                        barSize={10}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="min-w-0 border-neutral-200 bg-white">
              <CardHeader className="flex items-center justify-between border-b border-neutral-200 pb-4">
                <div>
                  <CardTitle className="text-lg text-neutral-900">Order mix</CardTitle>
                  <p className="text-sm text-neutral-500">Distribution by state</p>
                </div>
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700">
                  {orderStats.reduce((s, o) => s + o.value, 0)} orders
                </span>
              </CardHeader>
              <CardContent className="min-w-0 pt-4">
                <div className="h-72 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12 }}
                        labelStyle={{ color: "#111827" }}
                        itemStyle={{ color: "#111827" }}
                      />
                      <Legend
                        formatter={(value) => <span style={{ color: "#111827", fontSize: 12 }}>{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {orderStats.map((item) => (
                    <div
                      key={item.label}
                    onClick={() => {
                        const routes = {
                          'Delivered': '/ecs/food/orders/delivered',
                          'Processing': '/ecs/food/orders/processing',
                          'Cancelled': '/ecs/food/orders/canceled',
                          'Pending': '/ecs/food/orders/pending'
                        }
                        navigate(routes[item.label] || '/ecs/food/orders/all')
                      }}
                      className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 py-2 cursor-pointer hover:bg-neutral-50 hover:border-neutral-300 transition-all group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full transition-transform group-hover:scale-125" style={{ background: item.color }} />
                        <p className="text-sm text-neutral-800 group-hover:text-neutral-900">{item.label}</p>
                      </div>
                      <p className="text-sm font-semibold text-neutral-900">{item.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="min-w-0 border-neutral-200 bg-white">
              <CardHeader className="flex items-center justify-between border-b border-neutral-200 pb-4">
                <CardTitle className="text-lg text-neutral-900">Momentum snapshot</CardTitle>
                <span className="text-xs text-neutral-500">Summary: {ordersTotal} Orders</span>
              </CardHeader>
              <CardContent className="min-w-0 pt-4">
                <div className="h-64 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={monthlyData.slice(-6)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" stroke="#6b7280" />
                      <YAxis stroke="#6b7280" />
                      <Tooltip
                        contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12 }}
                        labelStyle={{ color: "#111827" }}
                        itemStyle={{ color: "#111827" }}
                      />
                      <Legend />
                      <Bar dataKey="orders" fill="#0ea5e9" radius={[8, 8, 0, 0]} name="Orders" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-neutral-200 bg-white">
              <CardHeader className="border-b border-neutral-200 pb-4">
                <CardTitle className="text-lg text-neutral-900">Live signals</CardTitle>
                <p className="text-sm text-neutral-500">Ops notes and service health</p>
              </CardHeader>
              <CardContent className="space-y-3 pt-4 h-[300px] overflow-y-auto custom-scrollbar">
                {activityFeed.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-10 text-neutral-400">
                    <Activity className="h-10 w-10 mb-2 opacity-20" />
                    <p className="text-sm">No recent signals</p>
                  </div>
                ) : (
                  activityFeed.map((item, idx) => {
                    const getIcon = (type) => {
                      switch (type) {
                        case "order_pending":
                          return <Clock className="h-4 w-4 text-amber-600" />
                        case "order_delivered":
                          return <CheckCircle className="h-4 w-4 text-emerald-600" />
                        case "order_cancelled":
                          return <XCircle className="h-4 w-4 text-red-600" />
                        case "restaurant":
                          return <Store className="h-4 w-4 text-primary" />
                        case "delivery":
                          return <Truck className="h-4 w-4 text-primary" />
                        case "customer":
                          return <UserCircle className="h-4 w-4 text-pink-600" />
                        default:
                          return <Activity className="h-4 w-4 text-neutral-600" />
                      }
                    }

                    const getBg = (type) => {
                      switch (type) {
                        case "order_pending":
                          return "bg-amber-50"
                        case "order_delivered":
                          return "bg-emerald-50"
                        case "order_cancelled":
                          return "bg-red-50"
                        case "restaurant":
                          return "bg-orange-50"
                        case "delivery":
                          return "bg-orange-50"
                        case "customer":
                          return "bg-pink-50"
                        default:
                          return "bg-neutral-50"
                      }
                    }

                    return (
                      <div
                        key={idx}
                        className={`flex items-start gap-3 rounded-xl border border-neutral-200 ${getBg(item.type)} px-3 py-3 hover:border-neutral-300 transition-all`}
                      >
                        <div className="mt-0.5">{getIcon(item.type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-neutral-900 truncate">{item.title}</p>
                            <span className="text-[10px] text-neutral-400 whitespace-nowrap">{item.time}</span>
                          </div>
                          <p className="text-xs text-neutral-600 line-clamp-1">{item.detail}</p>
                        </div>
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>

            <Card className="border-neutral-200 bg-white">
              <CardHeader className="border-b border-neutral-200 pb-4">
                <CardTitle className="text-lg text-neutral-900">Order states</CardTitle>
                <p className="text-sm text-neutral-500">Quick glance by status</p>
              </CardHeader>
              <CardContent className="grid gap-3 pt-4">
                {orderStats.map((item) => (
                  <div
                    key={item.label}
                    onClick={() => {
                      const routes = {
                        'Delivered': '/ecs/food/orders/delivered',
                        'Processing': '/ecs/food/orders/processing',
                        'Cancelled': '/ecs/food/orders/canceled',
                        'Pending': '/ecs/food/orders/pending'
                      }
                      navigate(routes[item.label] || '/ecs/food/orders/all')
                    }}
                    className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 cursor-pointer hover:bg-neutral-100 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold text-neutral-900 transition-transform group-hover:scale-110"
                        style={{ background: `${item.color}1A`, color: item.color }}
                      >
                        {item.label.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <p className="text-sm text-neutral-900 group-hover:font-medium">{item.label}</p>
                        <p className="text-xs text-neutral-500">Tracked in {selectedPeriod}</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-neutral-900">{item.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ title, value, helper, icon, accent, path }) {
  const { user: authUser } = useAuth()
  const user = useMemo(() => authUser || getCurrentUser("admin"), [authUser])
  const navigate = useNavigate()
  const [resolvedPermissions, setResolvedPermissions] = useState({})

  useEffect(() => {
    let isMounted = true

    const resolvePermissions = async () => {
      if (!user || user.role === "ADMIN") {
        if (isMounted) setResolvedPermissions({})
        return
      }

      const existingPermissions = extractAdminPermissions(user)
      if (Object.keys(existingPermissions).length > 0) {
        if (isMounted) setResolvedPermissions(existingPermissions)
        return
      }

      const roleId = extractAdminRoleId(user)
      if (!roleId) {
        if (isMounted) setResolvedPermissions({})
        return
      }

      try {
        const rolePermissions = await fetchAdminRolePermissions(roleId)
        if (isMounted) setResolvedPermissions(rolePermissions)
      } catch {
        if (isMounted) setResolvedPermissions({})
      }
    }

    resolvePermissions()
    return () => {
      isMounted = false
    }
  }, [user])

  if (path && !canAccessAdminPath(user, resolvedPermissions, path)) {
    return null
  }

  return (
    <Card
      className="group relative overflow-hidden border-neutral-200 bg-white p-0 cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 active:scale-[0.98]"
      onClick={() => path && navigate(path)}
    >
      <CardContent className="relative flex flex-col gap-2 px-4 pb-4 pt-4 h-full">
        <div className={`absolute inset-0 opacity-40 transition-opacity duration-300 group-hover:opacity-60 ${accent}`} />
        <div className="relative flex items-center justify-between z-10">
          <div className="flex-1 min-w-0 mr-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 font-bold mb-1 truncate">{title}</p>
            <p className="text-xl font-bold text-neutral-900 leading-tight mb-1">{value}</p>
            <p className="text-[10px] text-neutral-500 font-medium line-clamp-1">{helper}</p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/90 ring-1 ring-neutral-200 shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 group-hover:shadow-md">
            {icon}
          </div>
        </div>
        <div className="absolute bottom-2 right-2 opacity-0 transform translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
          <ArrowUpRight className="h-3 w-3 text-neutral-400" />
        </div>
      </CardContent>
    </Card>
  )
}

