import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@food/components/ui/select';
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  Boxes,
  MapPinned,
  Package,
  RotateCcw,
  ShoppingBag,
  Store,
  Truck,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  BLAZE_CHART,
  CardSkeleton,
  ChartSkeleton,
  EmptyState,
  KpiGridSkeleton,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/shared/components/admin';
import { adminApi } from '../services/adminApi';

const INR_SYMBOL = '\u20B9';

const formatCurrency = (amount, options = {}) =>
  `${INR_SYMBOL}${Number(amount || 0).toLocaleString('en-IN', options)}`;

const formatNumber = (value) => Number(value || 0).toLocaleString('en-IN');

const calcGrowth = (current, previous) => {
  const safeCurrent = Number(current || 0);
  const safePrevious = Number(previous || 0);

  if (!safePrevious) return safeCurrent > 0 ? '+100%' : '0%';
  const change = ((safeCurrent - safePrevious) / safePrevious) * 100;
  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
};

const legendFormatter = (value) => (
  <span style={{ color: '#1A1A1A', fontSize: 12 }}>{value}</span>
);

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [selectedZone, setSelectedZone] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('overall');
  const [zones, setZones] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const fetchZones = async () => {
      try {
        const response = await adminApi.getZones({ page: 1, limit: 1000 });
        const list = response?.data?.data?.zones || [];
        setZones(Array.isArray(list) ? list : []);
      } catch {
        setZones([]);
      }
    };

    fetchZones();
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = {
        period: selectedPeriod,
        ...(selectedZone !== 'all' ? { zoneId: selectedZone } : {}),
      };
      const response = await adminApi.getDashboard(params);
      const payload = response?.data?.result;

      if (response?.data?.success && payload) {
        setDashboardData(payload);
        setHasError(false);
        return;
      }

      setHasError(true);
      toast.error('Failed to load quick commerce dashboard');
    } catch (error) {
      console.error('Quick dashboard fetch error:', error);
      setHasError(true);
      toast.error('Failed to load quick commerce dashboard');
    } finally {
      setIsLoading(false);
    }
  }, [selectedPeriod, selectedZone]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const overview = dashboardData?.overview || {};
  const chartData = dashboardData?.revenueHistory || [];
  const categoryData = dashboardData?.categoryData || [];
  const recentOrders = dashboardData?.recentOrders || [];
  const topProducts = dashboardData?.topProducts || [];
  const inventoryAlerts = dashboardData?.inventoryAlerts || [];
  const sellerLeaderboard = dashboardData?.sellerLeaderboard || [];
  const orderStatus = dashboardData?.orderStatus || {};

  const orderStats = useMemo(
    () => [
      { label: 'Delivered', value: Number(orderStatus.delivered || 0), color: BLAZE_CHART.success, route: '/ecs/quick-commerce/orders/delivered' },
      { label: 'Processing', value: Number(orderStatus.processing || 0), color: BLAZE_CHART.info, route: '/ecs/quick-commerce/orders/processed' },
      { label: 'Out for delivery', value: Number(orderStatus.outForDelivery || 0), color: BLAZE_CHART.primary, route: '/ecs/quick-commerce/orders/out-for-delivery' },
      { label: 'Pending', value: Number(orderStatus.pending || 0), color: BLAZE_CHART.warning, route: '/ecs/quick-commerce/orders/pending' },
      { label: 'Cancelled', value: Number(orderStatus.cancelled || 0), color: BLAZE_CHART.danger, route: '/ecs/quick-commerce/orders/cancelled' },
    ],
    [orderStatus]
  );

  const pieData = useMemo(
    () =>
      orderStats.map((item) => ({
        name: item.label,
        value: item.value,
        fill: item.color,
        route: item.route,
      })),
    [orderStats]
  );

  const periodLabel = selectedPeriod === 'overall'
    ? 'Overall'
    : selectedPeriod === 'today'
      ? "Today's"
      : selectedPeriod === 'week'
        ? 'This week'
        : selectedPeriod === 'month'
          ? 'This month'
          : 'This year';

  const stats = [
    {
      title: 'Sales revenue',
      value: formatCurrency(overview.totalRevenue),
      helper: Number(overview.totalReturnRefunds || 0) > 0
        ? `Net after ${formatCurrency(overview.totalReturnRefunds)} return refunds`
        : `${calcGrowth(overview.totalRevenue, overview.prevTotalRevenue)} vs previous period`,
      icon: <ShoppingBag className="h-5 w-5" />,
      to: '/ecs/quick-commerce/transactions',
    },
    {
      title: 'Return refunds',
      value: formatCurrency(overview.totalReturnRefunds || 0),
      helper: `${formatNumber(overview.totalReturnsCompleted || 0)} completed returns`,
      icon: <RotateCcw className="h-5 w-5" />,
      to: '/ecs/quick-commerce/returns',
    },
    {
      title: 'Total orders',
      value: formatNumber(overview.totalOrders),
      helper: `${calcGrowth(overview.totalOrders, overview.prevTotalOrders)} vs previous period`,
      icon: <Truck className="h-5 w-5" />,
      to: '/ecs/quick-commerce/orders/all',
    },
    {
      title: 'Active sellers',
      value: formatNumber(overview.activeSellers),
      helper: `${formatNumber(overview.pendingSellers)} pending approvals`,
      icon: <Store className="h-5 w-5" />,
      to: '/ecs/quick-commerce/sellers/active',
    },
    {
      title: 'Customers reached',
      value: formatNumber(overview.totalCustomers),
      helper: `${calcGrowth(overview.totalCustomers, overview.prevTotalCustomers)} vs previous period`,
      icon: <Users className="h-5 w-5" />,
      to: '/ecs/quick-commerce/customers',
    },
    {
      title: 'Live products',
      value: formatNumber(overview.activeProducts),
      helper: `${formatNumber(overview.totalCategories)} active categories`,
      icon: <Package className="h-5 w-5" />,
      to: '/ecs/quick-commerce/products',
    },
    {
      title: 'Low stock items',
      value: formatNumber(overview.lowStockProducts),
      helper: 'Products below reorder threshold',
      icon: <AlertTriangle className="h-5 w-5" />,
      to: '/ecs/quick-commerce/products',
    },
    {
      title: 'Out of stock',
      value: formatNumber(overview.outOfStockProducts),
      helper: 'Requires immediate restock',
      icon: <Boxes className="h-5 w-5" />,
      to: '/ecs/quick-commerce/products',
    },
    {
      title: 'Zones covered',
      value: formatNumber(overview.totalZones),
      helper: selectedZone === 'all' ? 'All quick-commerce service areas' : 'Selected service zone',
      icon: <MapPinned className="h-5 w-5" />,
      to: '/ecs/quick-commerce/zone-setup',
    },
  ];

  const showInitialSkeleton = isLoading && !dashboardData;

  return (
    <div className="blaze-theme-scope min-h-full bg-background">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <PageHeader
            eyebrow="Quick Commerce"
            title="Operations Command"
            description={`${periodLabel} marketplace performance for orders, sellers, products, and inventory`}
            actions={
              <>
                {isLoading && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
                    <span className="h-2 w-2 animate-ping rounded-full bg-primary/70" />
                    Updating metrics...
                  </span>
                )}
                <Select value={selectedZone} onValueChange={setSelectedZone}>
                  <SelectTrigger className="h-10 min-w-[170px] rounded-xl border-border bg-card text-foreground shadow-sm">
                    <SelectValue placeholder="All zones" />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card text-foreground">
                    <SelectItem value="all">All zones</SelectItem>
                    {zones.map((zone) => (
                      <SelectItem key={zone._id} value={zone._id}>
                        {zone.zoneName || zone.name || 'Unnamed Zone'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="h-10 min-w-[140px] rounded-xl border-border bg-card text-foreground shadow-sm">
                    <SelectValue placeholder="Overall" />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card text-foreground">
                    <SelectItem value="overall">Overall</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This week</SelectItem>
                    <SelectItem value="month">This month</SelectItem>
                    <SelectItem value="year">This year</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={fetchDashboard}
                  className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground shadow-sm transition hover:bg-secondary"
                >
                  Refresh
                </button>
              </>
            }
          />

          {hasError && (
            <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
              <span>Couldn't refresh the quick commerce dashboard. Showing the last available values.</span>
              <button
                type="button"
                onClick={fetchDashboard}
                className="self-start rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-medium transition hover:bg-destructive/20 sm:self-auto"
              >
                Retry
              </button>
            </div>
          )}

          {showInitialSkeleton ? (
            <KpiGridSkeleton count={8} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => (
                <StatCard
                  key={stat.title}
                  title={stat.title}
                  value={stat.value}
                  helper={stat.helper}
                  icon={stat.icon}
                  to={stat.to}
                />
              ))}
            </div>
          )}

          {showInitialSkeleton ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <ChartSkeleton className="lg:col-span-2" />
              <ChartSkeleton />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              <SectionCard
                className="lg:col-span-2"
                title="Revenue trajectory"
                subtitle="Delivered quick-commerce sales with order throughput"
              >
                <div className="h-80 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="quickRevenueFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={BLAZE_CHART.primary} stopOpacity={0.22} />
                          <stop offset="95%" stopColor={BLAZE_CHART.primary} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" stroke={BLAZE_CHART.grid} vertical={false} />
                      <XAxis dataKey="name" stroke={BLAZE_CHART.axis} tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis stroke={BLAZE_CHART.axis} tickLine={false} axisLine={false} fontSize={12} width={52} />
                      <Tooltip
                        cursor={BLAZE_CHART.tooltip.cursor}
                        contentStyle={BLAZE_CHART.tooltip.contentStyle}
                        labelStyle={BLAZE_CHART.tooltip.labelStyle}
                        itemStyle={BLAZE_CHART.tooltip.itemStyle}
                        formatter={(value, name) => [
                          name === 'Revenue' ? formatCurrency(value) : formatNumber(value),
                          name,
                        ]}
                      />
                      <Legend iconType="circle" formatter={legendFormatter} />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke={BLAZE_CHART.primary}
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#quickRevenueFill)"
                        name="Revenue"
                      />
                      <Bar
                        dataKey="orders"
                        fill={BLAZE_CHART.info}
                        radius={[6, 6, 0, 0]}
                        name="Orders"
                        barSize={10}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>

              <SectionCard
                title="Order mix"
                subtitle="Current distribution by fulfillment state"
                action={
                  <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                    {formatNumber(orderStats.reduce((sum, item) => sum + item.value, 0))} orders
                  </span>
                }
              >
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
                        contentStyle={BLAZE_CHART.tooltip.contentStyle}
                        labelStyle={BLAZE_CHART.tooltip.labelStyle}
                        itemStyle={BLAZE_CHART.tooltip.itemStyle}
                      />
                      <Legend iconType="circle" formatter={legendFormatter} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {orderStats.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => navigate(item.route)}
                      className="group flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-left transition-all hover:border-primary/30 hover:bg-secondary/60"
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full transition-transform group-hover:scale-125" style={{ background: item.color }} />
                        <p className="text-sm text-foreground">{item.label}</p>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{formatNumber(item.value)}</p>
                    </button>
                  ))}
                </div>
              </SectionCard>
            </div>
          )}

          {showInitialSkeleton ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              <SectionCard
                title="Top categories"
                subtitle="Best-performing categories by units sold"
                footer={
                  <button
                    type="button"
                    onClick={() => navigate('/ecs/quick-commerce/categories/hierarchy')}
                    className="text-xs font-semibold text-primary transition hover:opacity-80"
                  >
                    View category hierarchy
                  </button>
                }
              >
                <div className="space-y-3">
                  {categoryData.length === 0 ? (
                    <EmptyState
                      icon={<Boxes className="h-10 w-10" />}
                      title="No category sales yet"
                      description="Category performance will appear here once quick orders start flowing."
                    />
                  ) : (
                    categoryData.map((category) => (
                      <div key={category.id || category.name} className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{category.name}</p>
                            <p className="text-xs text-muted-foreground">{formatCurrency(category.revenue)} revenue</p>
                          </div>
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-foreground">{formatNumber(category.value)}</p>
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>

              <SectionCard
                title="Inventory radar"
                subtitle="Products that need immediate stock action"
                footer={
                  <button
                    type="button"
                    onClick={() => navigate('/ecs/quick-commerce/products')}
                    className="text-xs font-semibold text-primary transition hover:opacity-80"
                  >
                    Manage products
                  </button>
                }
              >
                <div className="space-y-3">
                  {inventoryAlerts.length === 0 ? (
                    <EmptyState
                      icon={<Package className="h-10 w-10" />}
                      title="Inventory looks healthy"
                      description="Low-stock and out-of-stock products will show here automatically."
                    />
                  ) : (
                    inventoryAlerts.map((item) => (
                      <div key={item.id} className="rounded-xl border border-border bg-card px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{item.storeName} · {item.categoryName}</p>
                          </div>
                          <StatusBadge
                            status={item.status === 'out_of_stock' ? 'cancelled' : 'pending'}
                            label={item.status === 'out_of_stock' ? 'Out of stock' : 'Low stock'}
                            className="text-[10px]"
                          />
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                          <span>Available: {formatNumber(item.stock)}</span>
                          <span>Threshold: {formatNumber(item.threshold)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>

              <SectionCard
                title="Seller spotlight"
                subtitle="Top stores by profile health"
                footer={
                  <button
                    type="button"
                    onClick={() => navigate('/ecs/quick-commerce/sellers/active')}
                    className="text-xs font-semibold text-primary transition hover:opacity-80"
                  >
                    View active sellers
                  </button>
                }
              >
                <div className="space-y-3">
                  {sellerLeaderboard.length === 0 ? (
                    <EmptyState
                      icon={<Store className="h-10 w-10" />}
                      title="No seller insights yet"
                      description="Approved stores will populate this panel as the marketplace grows."
                    />
                  ) : (
                    sellerLeaderboard.map((seller) => (
                      <div key={seller.id} className="rounded-xl border border-border bg-card px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{seller.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Rating {Number(seller.rating || 0).toFixed(1)} · {formatNumber(seller.reviews)} reviews
                            </p>
                          </div>
                          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground">
                            {formatNumber(seller.recentOrders)} recent
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>
            </div>
          )}

          {showInitialSkeleton ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <CardSkeleton className="lg:col-span-2" />
              <CardSkeleton />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              <SectionCard
                className="lg:col-span-2"
                title="Recent orders"
                subtitle="Latest quick-commerce customer activity"
                footer={
                  <button
                    type="button"
                    onClick={() => navigate('/ecs/quick-commerce/orders/all')}
                    className="text-xs font-semibold text-primary transition hover:opacity-80"
                  >
                    View all orders
                  </button>
                }
              >
                {recentOrders.length === 0 ? (
                  <EmptyState
                    icon={<Activity className="h-10 w-10" />}
                    title="No recent orders"
                    description="New quick-commerce orders will appear here as soon as customers place them."
                  />
                ) : (
                  <div className="space-y-3">
                    {recentOrders.map((order) => (
                      <button
                        key={order.id}
                        type="button"
                        onClick={() => navigate(`/ecs/quick-commerce/orders/view/${order.orderId}`)}
                        className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3 text-left transition-all hover:border-primary/30 hover:bg-secondary/50"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-primary">{order.id}</p>
                            <StatusBadge status={order.status} label={order.statusText} className="text-[10px]" />
                            {order.hasReturn || order.returnStatus ? (
                              <StatusBadge
                                status="return"
                                label={order.returnStatusLabel || order.returnStatus || 'Return'}
                                className="text-[10px]"
                              />
                            ) : null}
                          </div>
                          <p className="mt-1 truncate text-sm text-foreground">{order.customer}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {order.seller || 'Quick Commerce'} · {formatNumber(order.itemCount)} items
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-foreground">
                            {formatCurrency(
                              Number(order.refundedAmount || 0) > 0
                                ? order.netAfterReturn
                                : order.amount,
                            )}
                          </p>
                          {Number(order.refundedAmount || 0) > 0 ? (
                            <p className="text-[10px] text-rose-600">
                              Refunded {formatCurrency(order.refundedAmount)}
                            </p>
                          ) : null}
                          <p className="text-xs text-muted-foreground">{order.time}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard
                title="Top products"
                subtitle="Best sellers in the selected scope"
                footer={
                  <button
                    type="button"
                    onClick={() => navigate('/ecs/quick-commerce/products')}
                    className="text-xs font-semibold text-primary transition hover:opacity-80"
                  >
                    View all products
                  </button>
                }
              >
                {topProducts.length === 0 ? (
                  <EmptyState
                    icon={<Package className="h-10 w-10" />}
                    title="No sales data yet"
                    description="Top-selling products will appear here once orders are delivered."
                  />
                ) : (
                  <div className="space-y-3">
                    {topProducts.map((product) => (
                      <div key={product.id || product.name} className="rounded-xl border border-border bg-card px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {product.cat} {product.storeName ? `· ${product.storeName}` : ''}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-semibold text-foreground">{formatCurrency(product.revenue)}</p>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{formatNumber(product.quantity)} units</span>
                          <span>{formatNumber(product.orders)} orders</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

