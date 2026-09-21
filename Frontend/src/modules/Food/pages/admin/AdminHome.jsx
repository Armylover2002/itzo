import { useEffect, useMemo, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { RESTAURANT_COMMISSION_ENABLED } from "@food/constants/commission"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@food/components/ui/select"
import {
  PageHeader,
  SectionCard,
  StatCard,
  EmptyState,
  KpiGridSkeleton,
  ITZO_CHART,
} from "@/shared/components/admin"
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
import { Activity, ShoppingBag, CreditCard, Truck, Receipt, IndianRupee, Store, UserCheck, Package, UserCircle, Clock, CheckCircle, Plus, XCircle, UtensilsCrossed, Wallet, CalendarCheck } from "lucide-react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import { useAuth } from "@core/context/AuthContext"
import { getCurrentUser } from "@food/utils/auth"
import { canAccessAdminPath, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions"
import { cn } from "@food/utils/utils"
const debugLog = () => { }
const debugError = () => { }

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
  const [hasError, setHasError] = useState(false)
  const [zones, setZones] = useState([])
  const [resolvedPermissions, setResolvedPermissions] = useState({})
  const [subOverview, setSubOverview] = useState(null)
  const [diningStats, setDiningStats] = useState(null)

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

  const canAccessPath = useCallback(
    (path) => canAccessAdminPath(user, resolvedPermissions, path),
    [user, resolvedPermissions]
  );



  // Fetch zone list for filter
  useEffect(() => {
    const fetchZones = async () => {
      try {
        const response = await adminAPI.getZones({ page: 1, limit: 1000, view: "summary" })
        const list = response?.data?.data?.zones || []
        setZones(Array.isArray(list) ? list : [])
      } catch (error) {
        debugError("Error fetching zones:", error)
        setZones([])
      }
    }

    fetchZones()
  }, [])

  // Fetch subscription overview stats for the dashboard card row
  useEffect(() => {
    const fetchSubOverview = async () => {
      try {
        const response = await adminAPI.getSubscriptionOverview()
        if (response.data?.success && response.data?.data) {
          setSubOverview(response.data.data)
        }
      } catch (err) {
        debugError("Error fetching subscription overview:", err)
      }
    }
    fetchSubOverview()
  }, [])

  const canViewDining = useMemo(
    () => canAccessAdminPath(user, resolvedPermissions, "/ecs/food/dining/bills"),
    [user, resolvedPermissions]
  )

  useEffect(() => {
    if (!canViewDining) {
      setDiningStats(null)
      return undefined
    }
    let cancelled = false
    adminAPI
      .getDiningRevenueStats()
      .then((response) => {
        const stats = response?.data?.data
        if (!cancelled && response?.data?.success && stats) setDiningStats(stats)
      })
      .catch((err) => debugError("Error fetching dining stats:", err))
    return () => {
      cancelled = true
    }
  }, [canViewDining])

  // Fetch dashboard stats from backend when filters change
  const fetchDashboardStats = useCallback(async () => {
    try {
      setIsLoading(true)
      const params = {
        period: selectedPeriod,
        ...(selectedZone !== "all" ? { zoneId: selectedZone } : {}),
      }
      const response = await adminAPI.getDashboardStats(params)
      if (response.data?.success && response.data?.data) {
        setDashboardData(response.data.data)
        setHasError(false)
        debugLog("Dashboard stats fetched:", response.data.data)
      } else {
        setHasError(true)
        debugError("Invalid dashboard response format:", response.data)
        toast.error(response?.data?.message || "Failed to load dashboard metrics")
      }
    } catch (err) {
      setHasError(true)
      debugError("Error fetching dashboard stats:", err)
      toast.error("Failed to load dashboard metrics")
    } finally {
      setIsLoading(false)
    }
  }, [selectedZone, selectedPeriod])

  useEffect(() => {
    fetchDashboardStats()
  }, [fetchDashboardStats])

  // Get order stats from real data
  const orderStats = useMemo(() => {
    if (!dashboardData?.orders?.byStatus) {
      return [
        { label: "Delivered", value: 0, color: ITZO_CHART.success },
        { label: "Processing", value: 0, color: ITZO_CHART.info },
        { label: "Cancelled", value: 0, color: ITZO_CHART.danger },
        { label: "Pending", value: 0, color: ITZO_CHART.warning },
        { label: "Refunded", value: 0, color: ITZO_CHART.violet },
      ]
    }

    const byStatus = dashboardData.orders.byStatus
    return [
      { label: "Delivered", value: byStatus.delivered || 0, color: ITZO_CHART.success },
      { label: "Processing", value: byStatus.processing || 0, color: ITZO_CHART.info },
      { label: "Cancelled", value: byStatus.cancelled || 0, color: ITZO_CHART.danger },
      { label: "Pending", value: byStatus.pending || 0, color: ITZO_CHART.warning },
      { label: "Refunded", value: byStatus.refunded || 0, color: ITZO_CHART.violet },
    ]
  }, [dashboardData]);

  // Get monthly data from real data
  const monthlyData = useMemo(() => {
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
  }, [dashboardData]);

  // Calculate totals from real data
  const revenueTotal = dashboardData?.revenue?.total || 0
  const ordersTotal = dashboardData?.orders?.total || 0
  const platformFeeTotal = dashboardData?.platformFee?.total || 0
  const deliveryFeeTotal = dashboardData?.deliveryFee?.total || 0
  const gstTotal = dashboardData?.gst?.total || 0
  const totalAdminEarnings = dashboardData?.totalAdminEarnings || 0
  const quickKpis = dashboardData?.quickDelivery || {}
  const quickFeeRevenue = Number(quickKpis.feeRevenue || 0)
  const quickOrdersCount = Number(quickKpis.orders || 0)
  const quickAttachRate = Number(quickKpis.attachmentRate || 0)
  const quickSlaBreachRate = Number(quickKpis.slaBreachRate || 0)

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

  const pieData = useMemo(() => {
    return orderStats.map((item) => ({
      name: item.label,
      value: item.value,
      fill: item.color,
    }));
  }, [orderStats]);

  const deliveryProfit = dashboardData?.deliveryProfit || 0
  const periodLabel = selectedPeriod === "overall" ? "Overall" :
    selectedPeriod === "today" ? "Today's" :
      `This ${selectedPeriod}'s`

  // Platform Total = Admin Earning (matches Transaction Report).
  // Three-part breakdown as requested: Platform Fee + Restaurant Commission + Quick admin share.
  const ptBreakdown = dashboardData?.platformTotalBreakdown || {}
  const ptPlatformFee = Number(ptBreakdown.platformFee || 0)
  const ptRestaurantCommission = Number(ptBreakdown.restaurantCommission || 0)
  const ptQuickShare = Number(ptBreakdown.quickPlatformShare || 0)
  // totalAdminEarnings already = ptBreakdown.net (source of truth: FoodTransaction snapshot)

  const activityFeed = dashboardData?.liveSignals || []
  const platformFeePlusCommissionLabel = `Platform fee: ${formatCurrency(ptPlatformFee)}`
  const commissionBreakdownLabel = `Rest. commission: ${formatCurrency(ptRestaurantCommission)}`
  const quickBreakdownLabel = `Quick share: ${formatCurrency(ptQuickShare)}`
  // Old fallback helper only if breakdown is empty (legacy cache fallback)
  const totalRevenueHelperParts = [
    platformFeePlusCommissionLabel,
    ...(RESTAURANT_COMMISSION_ENABLED ? [commissionBreakdownLabel] : []),
    quickBreakdownLabel,
  ]
  const totalRevenueHelper = ptBreakdown && (ptPlatformFee > 0 || ptRestaurantCommission > 0 || ptQuickShare > 0)
    ? totalRevenueHelperParts.join(" · ")
    : [
        `Platform fee: ${formatCurrency(platformFeeTotal)}`,
        `Delivery net: ${formatCurrency(deliveryProfit)}`,
      ].join(" + ")

  const showInitialSkeleton = isLoading && !dashboardData

  const orderRoutes = {
    Delivered: "/ecs/food/orders/delivered",
    Processing: "/ecs/food/orders/processing",
    Cancelled: "/ecs/food/orders/canceled",
    Pending: "/ecs/food/orders/pending",
    Refunded: "/ecs/food/orders/refunded",
  }

  return (
    <div className="itzo-theme-scope min-h-full bg-slate-50">
      <div className="mx-auto w-full px-3 md:px-4 py-4 max-w-[1600px]">
        <div className="space-y-4">
      <PageHeader
        title="Operations Command"
        description={`${periodLabel} performance across your marketplace`}
        className="pb-3 border-b border-slate-200/60 mb-1 gap-3"
        actions={
          <>
            {isLoading && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 shadow-xs">
                <span className="h-1.5 w-1.5 animate-ping rounded-full bg-red-500/70" />
                Updating…
              </span>
            )}
            <Select value={selectedZone} onValueChange={setSelectedZone}>
              <SelectTrigger className="h-8 min-w-[140px] rounded-lg border-slate-200 bg-white text-xs font-medium text-slate-700 shadow-xs">
                <SelectValue placeholder="All zones" />
              </SelectTrigger>
              <SelectContent className="border-slate-200 bg-white text-slate-800">
                <SelectItem value="all">All zones</SelectItem>
                {zones.map((zone) => (
                  <SelectItem key={zone._id} value={zone._id}>
                    {zone.zoneName || zone.name || "Unnamed Zone"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="h-8 min-w-[120px] rounded-lg border-slate-200 bg-white text-xs font-medium text-slate-700 shadow-xs">
                <SelectValue placeholder="Overall" />
              </SelectTrigger>
              <SelectContent className="border-slate-200 bg-white text-slate-800">
                <SelectItem value="overall">Overall</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This week</SelectItem>
                <SelectItem value="month">This month</SelectItem>
                <SelectItem value="year">This year</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      {hasError && (
        <div className="mb-2 flex flex-col gap-2 rounded-xl border border-rose-200 bg-[#FEF2F2] px-3 py-2.5 text-xs text-rose-700 sm:flex-row sm:items-center sm:justify-between">
          <span>Couldn't refresh dashboard metrics. Showing the last available values.</span>
          <button
            type="button"
            onClick={fetchDashboardStats}
            className="self-start rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] font-semibold transition hover:bg-rose-100 sm:self-auto"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI grid — seller-style compact colored cards */}
      {showInitialSkeleton ? (
        <KpiGridSkeleton count={8} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          <StatCard
            title="Gross revenue"
            value={formatCurrency(revenueTotal)}
            helper={`${periodLabel} transaction volume`}
            icon={<ShoppingBag className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            cardBg="bg-[#F0FDF4] border-emerald-200/60 hover:border-emerald-300/80"
            iconBg="bg-emerald-100/80"
            iconColor="text-emerald-700"
            to="/ecs/food/transaction-report"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Processing orders"
            value={processingOrders.toLocaleString("en-IN")}
            helper="Orders currently in processing"
            icon={<Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            cardBg="bg-[#F0F9FF] border-sky-200/60 hover:border-sky-300/80"
            iconBg="bg-sky-100/80"
            iconColor="text-sky-700"
            to="/ecs/food/orders/processing"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Platform fee"
            value={formatCurrency(platformFeeTotal)}
            helper={`Platform service fees: ${periodLabel}`}
            icon={<CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            cardBg="bg-[#F5F3FF] border-purple-200/60 hover:border-purple-300/80"
            iconBg="bg-purple-100/80"
            iconColor="text-purple-700"
            to="/ecs/food/fee-settings"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Delivery fee"
            value={formatCurrency(deliveryFeeTotal)}
            helper={`Total delivery fees: ${periodLabel}`}
            icon={<Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            cardBg="bg-[#FFFBEB] border-amber-200/60 hover:border-amber-300/80"
            iconBg="bg-amber-100/80"
            iconColor="text-amber-700"
            to="/ecs/food/transaction-report"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Quick Delivery"
            value={formatCurrency(quickFeeRevenue)}
            helper={`${quickOrdersCount.toLocaleString("en-IN")} orders · ${quickAttachRate}% attach · SLA breach ${quickSlaBreachRate}%`}
            icon={<Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            cardBg="bg-[#FEF2F2] border-rose-200/60 hover:border-rose-300/80"
            iconBg="bg-rose-100/80"
            iconColor="text-rose-700"
            to="/ecs/food/orders/all"
            canAccess={canAccessPath}
          />
          <StatCard
            title="GST"
            value={formatCurrency(gstTotal)}
            helper={`Total tax collected: ${periodLabel}`}
            icon={<Receipt className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            cardBg="bg-[#F0F9FF] border-sky-200/60 hover:border-sky-300/80"
            iconBg="bg-sky-100/80"
            iconColor="text-sky-700"
            to="/ecs/food/tax-report"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Platform Total"
            value={formatCurrency(totalAdminEarnings, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            helper={totalRevenueHelper}
            icon={<IndianRupee className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            cardBg="bg-[#F0FDF4] border-emerald-200/60 hover:border-emerald-300/80"
            iconBg="bg-emerald-100/80"
            iconColor="text-emerald-700"
            to="/ecs/food/transaction-report"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Total restaurants"
            value={totalRestaurants.toLocaleString("en-IN")}
            helper="Approved restaurants"
            icon={<Store className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            cardBg="bg-[#F5F3FF] border-purple-200/60 hover:border-purple-300/80"
            iconBg="bg-purple-100/80"
            iconColor="text-purple-700"
            to="/ecs/food/restaurants"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Restaurant request pending"
            value={pendingRestaurantRequests.toLocaleString("en-IN")}
            helper="Awaiting approval"
            icon={<UserCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            cardBg="bg-[#FFFBEB] border-amber-200/60 hover:border-amber-300/80"
            iconBg="bg-amber-100/80"
            iconColor="text-amber-700"
            to="/ecs/food/restaurants/joining-request"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Total delivery boy"
            value={totalDeliveryBoys.toLocaleString("en-IN")}
            helper="Approved delivery partners"
            icon={<Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            cardBg="bg-[#F0F9FF] border-sky-200/60 hover:border-sky-300/80"
            iconBg="bg-sky-100/80"
            iconColor="text-sky-700"
            to="/ecs/food/delivery-partners"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Delivery boy request pending"
            value={pendingDeliveryBoyRequests.toLocaleString("en-IN")}
            helper="Awaiting verification"
            icon={<Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            cardBg="bg-[#FEF2F2] border-rose-200/60 hover:border-rose-300/80"
            iconBg="bg-rose-100/80"
            iconColor="text-rose-700"
            to="/ecs/food/delivery-partners/join-request"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Total foods"
            value={totalFoods.toLocaleString("en-IN")}
            helper="Approved menu items"
            icon={<Package className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            cardBg="bg-[#F0FDF4] border-emerald-200/60 hover:border-emerald-300/80"
            iconBg="bg-emerald-100/80"
            iconColor="text-emerald-700"
            to="/ecs/food/foods"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Total addons"
            value={totalAddons.toLocaleString("en-IN")}
            helper="Approved addon items"
            icon={<Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            cardBg="bg-[#F5F3FF] border-purple-200/60 hover:border-purple-300/80"
            iconBg="bg-purple-100/80"
            iconColor="text-purple-700"
            to="/ecs/food/addons"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Total customers"
            value={totalCustomers.toLocaleString("en-IN")}
            helper="Registered users"
            icon={<UserCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            cardBg="bg-[#F0F9FF] border-sky-200/60 hover:border-sky-300/80"
            iconBg="bg-sky-100/80"
            iconColor="text-sky-700"
            to="/ecs/food/customers"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Pending orders"
            value={pendingOrders.toLocaleString("en-IN")}
            helper="Orders awaiting processing"
            icon={<Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            cardBg="bg-[#FFFBEB] border-amber-200/60 hover:border-amber-300/80"
            iconBg="bg-amber-100/80"
            iconColor="text-amber-700"
            to="/ecs/food/orders/pending"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Completed orders"
            value={completedOrders.toLocaleString("en-IN")}
            helper="Successfully delivered"
            icon={<CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            cardBg="bg-[#F0FDF4] border-emerald-200/60 hover:border-emerald-300/80"
            iconBg="bg-emerald-100/80"
            iconColor="text-emerald-700"
            to="/ecs/food/orders/delivered"
            canAccess={canAccessPath}
          />
        </div>
      )}

      {/* Subscription Operations Section */}
      <div className="pt-4 border-t border-neutral-200/60 mt-6">
        <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-4">Subscription Operations Command</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5">
          <StatCard
            title="Net revenue"
            value={formatCurrency(subOverview?.totalRevenue || 0)}
            helper="Gross collected all-time"
            icon={<IndianRupee className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            cardBg="bg-[#F5F3FF] border-purple-200/60 hover:border-purple-300/80"
            iconBg="bg-purple-100/80"
            iconColor="text-purple-700"
            to="/ecs/food/subscriptions?source=revenue"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Active paid users"
            value={`${subOverview?.activeSubscribers?.total || 0} (${subOverview?.activeSubscribers?.restaurants || 0} R / ${subOverview?.activeSubscribers?.deliveryPartners || 0} D)`}
            helper="Active subscription plans"
            icon={<Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            cardBg="bg-[#F5F3FF] border-purple-200/60 hover:border-purple-300/80"
            iconBg="bg-purple-100/80"
            iconColor="text-purple-700"
            to="/ecs/food/subscriptions?status=active"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Daily pass count"
            value={(subOverview?.oneDayPassCount || 0).toLocaleString("en-IN")}
            helper="One day passes activated"
            icon={<Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            cardBg="bg-[#F0F9FF] border-sky-200/60 hover:border-sky-300/80"
            iconBg="bg-sky-100/80"
            iconColor="text-sky-700"
            to="/ecs/food/subscriptions?type=DAILY_DEDUCTION"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Recharge revenue"
            value={formatCurrency(subOverview?.walletRechargeRevenue || 0)}
            helper="Wallet topup volume"
            icon={<CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            cardBg="bg-[#F0FDF4] border-emerald-200/60 hover:border-emerald-300/80"
            iconBg="bg-emerald-100/80"
            iconColor="text-emerald-700"
            to="/ecs/food/subscriptions?type=TOPUP"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Recurring plans"
            value={formatCurrency(subOverview?.recurringPlanRevenue || 0)}
            helper="Weekly & Monthly direct plans"
            icon={<Package className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            cardBg="bg-[#F5F3FF] border-purple-200/60 hover:border-purple-300/80"
            iconBg="bg-purple-100/80"
            iconColor="text-purple-700"
            to="/ecs/food/subscriptions?type=WEEKLY_SUBSCRIPTION"
            canAccess={canAccessPath}
          />
          <StatCard
            title="Expiring soon"
            value={(subOverview?.expiringSoon || 0).toLocaleString("en-IN")}
            helper="Plans expiring within 3 days"
            icon={<Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            cardBg="bg-[#FFFBEB] border-amber-200/60 hover:border-amber-300/80"
            iconBg="bg-amber-100/80"
            iconColor="text-amber-700"
            to="/ecs/food/subscriptions?status=expiring"
            canAccess={canAccessPath}
          />
        </div>
      </div>

      {/* Dining Operations Section */}
      {canViewDining && (
        <div className="pt-4 border-t border-neutral-200/60 mt-6">
          <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-4">Dining Operations</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
            <StatCard
              title="Dining revenue"
              value={formatCurrency(diningStats?.totalRevenue || 0)}
              helper="Paid dine-in bills, all-time"
              icon={<UtensilsCrossed className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
              cardBg="bg-[#F5F3FF] border-purple-200/60 hover:border-purple-300/80"
              iconBg="bg-purple-100/80"
              iconColor="text-purple-700"
              to="/ecs/food/dining/bills"
              canAccess={canAccessPath}
            />
            <StatCard
              title="Dining commission"
              value={formatCurrency(diningStats?.totalCommission || 0)}
              helper="Platform commission earned"
              icon={<Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
              cardBg="bg-[#F0FDF4] border-emerald-200/60 hover:border-emerald-300/80"
              iconBg="bg-emerald-100/80"
              iconColor="text-emerald-700"
              to="/ecs/food/dining/bills"
              canAccess={canAccessPath}
            />
            <StatCard
              title="Restaurant payouts"
              value={formatCurrency(diningStats?.totalPayout || 0)}
              helper="Settled to restaurant wallets"
              icon={<IndianRupee className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
              cardBg="bg-[#F0F9FF] border-sky-200/60 hover:border-sky-300/80"
              iconBg="bg-sky-100/80"
              iconColor="text-sky-700"
              to="/ecs/food/dining/bills"
              canAccess={canAccessPath}
            />
            <StatCard
              title="Bookings today"
              value={(diningStats?.bookingsToday || 0).toLocaleString("en-IN")}
              helper="Table reservations today"
              icon={<CalendarCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
              cardBg="bg-[#FFFBEB] border-amber-200/60 hover:border-amber-300/80"
              iconBg="bg-amber-100/80"
              iconColor="text-amber-700"
              to="/ecs/food/dining/bookings"
              canAccess={canAccessPath}
            />
          </div>
        </div>
      )}

      {/* Revenue + order mix */}
      <div className="grid gap-2.5 sm:gap-3.5 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2 !rounded-xl sm:!rounded-2xl !border-slate-200/80 !shadow-xs"
          title="Revenue trajectory"
          subtitle="Gross revenue with order volume"
        >
          <div className="h-64 sm:h-72 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={monthlyData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ITZO_CHART.primary} stopOpacity={0.22} />
                    <stop offset="95%" stopColor={ITZO_CHART.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke={ITZO_CHART.grid} vertical={false} />
                <XAxis dataKey="month" stroke={ITZO_CHART.axis} tickLine={false} axisLine={false} fontSize={11} />
                <YAxis stroke={ITZO_CHART.axis} tickLine={false} axisLine={false} fontSize={11} width={44} />
                <Tooltip
                  cursor={ITZO_CHART.tooltip.cursor}
                  contentStyle={ITZO_CHART.tooltip.contentStyle}
                  labelStyle={ITZO_CHART.tooltip.labelStyle}
                  itemStyle={ITZO_CHART.tooltip.itemStyle}
                />
                <Legend iconType="circle" formatter={legendFormatter} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={ITZO_CHART.primary}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#revFill)"
                  name="Gross revenue"
                />
                <Bar
                  dataKey="orders"
                  fill={ITZO_CHART.info}
                  radius={[6, 6, 0, 0]}
                  name="Orders"
                  barSize={10}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          className="!rounded-xl sm:!rounded-2xl !border-slate-200/80 !shadow-xs"
          title="Order mix"
          subtitle="Distribution by state"
          action={
            <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {orderStats.reduce((s, o) => s + o.value, 0)} orders
            </span>
          }
        >
          <div className="h-56 sm:h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={0}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={ITZO_CHART.tooltip.contentStyle}
                  labelStyle={ITZO_CHART.tooltip.labelStyle}
                  itemStyle={ITZO_CHART.tooltip.itemStyle}
                />
                <Legend iconType="circle" formatter={legendFormatter} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            {orderStats.map((item) => (
              <div
                key={item.label}
                onClick={() => navigate(orderRoutes[item.label] || "/ecs/food/orders/all")}
                className="group flex cursor-pointer items-center justify-between rounded-xl border border-slate-200/80 bg-white px-2.5 py-1.5 shadow-xs transition-all hover:border-slate-300 active:scale-[0.98]"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="h-2 w-2 rounded-full shrink-0 transition-transform group-hover:scale-125" style={{ background: item.color }} />
                  <p className="text-[11px] sm:text-xs font-medium text-slate-600 truncate">{item.label}</p>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-[#1c1c1e]">{item.value}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Momentum + live signals + order states */}
      <div className="grid gap-2.5 sm:gap-3.5 lg:grid-cols-3">
        <SectionCard
          className="!rounded-xl sm:!rounded-2xl !border-slate-200/80 !shadow-xs"
          title="Momentum snapshot"
          action={<span className="text-[11px] text-slate-500">Summary: {ordersTotal} Orders</span>}
        >
          <div className="h-52 sm:h-56 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={monthlyData.slice(-6)} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke={ITZO_CHART.grid} vertical={false} />
                <XAxis dataKey="month" stroke={ITZO_CHART.axis} tickLine={false} axisLine={false} fontSize={11} />
                <YAxis stroke={ITZO_CHART.axis} tickLine={false} axisLine={false} fontSize={11} width={36} />
                <Tooltip
                  cursor={ITZO_CHART.tooltip.cursor}
                  contentStyle={ITZO_CHART.tooltip.contentStyle}
                  labelStyle={ITZO_CHART.tooltip.labelStyle}
                  itemStyle={ITZO_CHART.tooltip.itemStyle}
                />
                <Legend iconType="circle" formatter={legendFormatter} />
                <Bar dataKey="orders" fill={ITZO_CHART.primary} radius={[8, 8, 0, 0]} name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          className="!rounded-xl sm:!rounded-2xl !border-slate-200/80 !shadow-xs"
          title="Live signals"
          subtitle="Ops notes and service health"
          flush
        >
          <div className="itzo-scroll h-[260px] space-y-2 overflow-y-auto p-3 sm:p-4">
            {activityFeed.length === 0 ? (
              <EmptyState
                icon={<Activity className="h-8 w-8" />}
                title="No recent signals"
                description="Live operational updates will appear here as they happen."
              />
            ) : (
              activityFeed.map((item, idx) => {
                const getIcon = (type) => {
                  switch (type) {
                    case "order_pending":
                      return <Clock className="h-3.5 w-3.5 text-amber-700" />
                    case "order_delivered":
                      return <CheckCircle className="h-3.5 w-3.5 text-emerald-700" />
                    case "order_cancelled":
                      return <XCircle className="h-3.5 w-3.5 text-rose-700" />
                    case "restaurant":
                      return <Store className="h-3.5 w-3.5 text-sky-700" />
                    case "delivery":
                      return <Truck className="h-3.5 w-3.5 text-red-600" />
                    case "customer":
                      return <UserCircle className="h-3.5 w-3.5 text-purple-700" />
                    default:
                      return <Activity className="h-3.5 w-3.5 text-slate-500" />
                  }
                }

                const chipTone = {
                  order_pending: "bg-amber-100/80",
                  order_delivered: "bg-emerald-100/80",
                  order_cancelled: "bg-rose-100/80",
                  restaurant: "bg-sky-100/80",
                  delivery: "bg-red-50",
                  customer: "bg-purple-100/80",
                }

                return (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 rounded-xl border border-slate-200/80 bg-white px-2.5 py-2 shadow-xs transition-all hover:border-slate-300"
                  >
                    <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-xs", chipTone[item.type] || "bg-slate-100")}>
                      {getIcon(item.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-semibold text-[#1c1c1e]">{item.title}</p>
                        <span className="whitespace-nowrap text-[10px] text-slate-500">{item.time}</span>
                      </div>
                      <p className="line-clamp-1 text-[11px] font-normal text-slate-500">{item.detail}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </SectionCard>

        <SectionCard
          className="!rounded-xl sm:!rounded-2xl !border-slate-200/80 !shadow-xs"
          title="Order states"
          subtitle="Quick glance by status"
        >
          <div className="grid gap-2">
            {orderStats.map((item) => (
              <div
                key={item.label}
                onClick={() => navigate(orderRoutes[item.label] || "/ecs/food/orders/all")}
                className="group flex cursor-pointer items-center justify-between rounded-xl border border-slate-200/80 bg-white px-2.5 py-2 shadow-xs transition-all hover:border-slate-300 active:scale-[0.98]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-semibold shadow-xs transition-transform group-hover:scale-105"
                    style={{ background: `${item.color}1A`, color: item.color }}
                  >
                    {item.label.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#1c1c1e] truncate">{item.label}</p>
                    <p className="text-[10px] font-normal text-slate-500">Tracked in {selectedPeriod}</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-[#1c1c1e]">{item.value}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
        </div>
      </div>
    </div>
  )
}

function legendFormatter(value) {
  return <span style={{ color: "#1c1c1e", fontSize: 11 }}>{value}</span>
}
