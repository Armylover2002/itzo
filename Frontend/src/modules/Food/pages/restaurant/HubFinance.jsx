import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  Bell,
  Menu,
  ChevronDown,
  Calendar,
  Download,
  ArrowRight,
  FileText,
  Wallet,
  X,
  Gift,
  AlertCircle,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import BottomNavOrders from "@food/components/restaurant/BottomNavOrders"
import { restaurantAPI } from "@food/api"
import { RESTAURANT_COMMISSION_ENABLED } from "@food/constants/commission"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

function getApiErrorMessage(error, fallback = "Something went wrong") {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallback
  )
}

export default function HubFinance() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get("tab")
    return tabParam === "invoices" ? "invoices" : "payouts"
  })
  const [selectedDateRange, setSelectedDateRange] = useState("Last 30 days")
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const [showDateRangePicker, setShowDateRangePicker] = useState(false)
  const downloadMenuRef = useRef(null)
  const dateRangePickerRef = useRef(null)
  const [financeData, setFinanceData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [financeError, setFinanceError] = useState(null)
  const [pastCyclesData, setPastCyclesData] = useState(null)
  const [loadingPastCycles, setLoadingPastCycles] = useState(false)
  const [restaurantData, setRestaurantData] = useState(null)
  const [loadingRestaurant, setLoadingRestaurant] = useState(true)
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false)
  const [withdrawalAmount, setWithdrawalAmount] = useState('')
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false)
  const [withdrawalRequests, setWithdrawalRequests] = useState([])
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false)
  const [withdrawalsError, setWithdrawalsError] = useState(null)
  const [referralStats, setReferralStats] = useState(null)

  const minWithdrawalLimit = Number(financeData?.withdrawalLimits?.min) || 1
  const rawMaxWithdrawal = financeData?.withdrawalLimits?.max
  const maxWithdrawalLimit =
    rawMaxWithdrawal != null && Number(rawMaxWithdrawal) > 0
      ? Number(rawMaxWithdrawal)
      : null
  const availableBalance = Number(financeData?.earnings?.availableBalance || 0)
  const maxAllowedWithdrawal =
    maxWithdrawalLimit != null
      ? Math.min(availableBalance, maxWithdrawalLimit)
      : availableBalance
  const canOpenWithdraw =
    availableBalance > 0 && maxAllowedWithdrawal >= minWithdrawalLimit

  const fetchFinanceData = useCallback(async () => {
    try {
      setLoading(true)
      setFinanceError(null)
      const response = await restaurantAPI.getFinance()
      if (response.data?.success && response.data?.data) {
        setFinanceData(response.data.data)
        debugLog('Finance data fetched:', response.data.data)
      } else {
        const message = response.data?.message || "Failed to load finance data"
        setFinanceData(null)
        setFinanceError(message)
        toast.error(message)
      }
    } catch (error) {
      // Suppress 401 — axios interceptor handles token refresh / redirect
      if (error.response?.status === 401) return
      const message = getApiErrorMessage(error, "Failed to load finance data")
      setFinanceData(null)
      setFinanceError(message)
      toast.error(message)
      debugError('Error fetching finance data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchWithdrawals = useCallback(async () => {
    try {
      setLoadingWithdrawals(true)
      setWithdrawalsError(null)
      const response = await restaurantAPI.getWithdrawalHistory({ page: 1, limit: 20 })
      const payload = response?.data?.data
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.withdrawals)
          ? payload.withdrawals
          : []
      setWithdrawalRequests(list)
    } catch (error) {
      if (error?.response?.status === 401) return
      const message = getApiErrorMessage(error, "Failed to load withdrawal history")
      setWithdrawalRequests([])
      setWithdrawalsError(message)
      toast.error(message)
      debugError('Error fetching withdrawal history:', error)
    } finally {
      setLoadingWithdrawals(false)
    }
  }, [])

  // Fetch finance data on mount
  useEffect(() => {
    const fetchReferralStats = async () => {
      try {
        const response = await restaurantAPI.getReferralStats()
        if (response.data?.success) {
          setReferralStats(response.data.data)
        }
      } catch (error) {
        if (error?.response?.status === 401) return
        // Non-blocking: page still works without referral strip
        toast.error(getApiErrorMessage(error, "Failed to load referral stats"))
        debugError('Error fetching referral stats:', error)
      }
    }

    fetchFinanceData()
    fetchReferralStats()
  }, [fetchFinanceData])

  useEffect(() => {
    fetchWithdrawals()
  }, [fetchWithdrawals])

  // Fetch restaurant data for header display
  useEffect(() => {
    // Use restaurant data from financeData if available, otherwise fetch separately
    if (financeData?.restaurant) {
      setRestaurantData(financeData.restaurant)
    } else {
      const fetchRestaurantData = async () => {
        try {
          const response = await restaurantAPI.getRestaurantByOwner()
          const data = response?.data?.data?.restaurant || response?.data?.restaurant || response?.data?.data
          if (data) {
            setRestaurantData({
              name: data.name,
              restaurantId: data.restaurantId || data._id,
              address: data.location?.address || data.location?.formattedAddress || data.address || ''
            })
          }
        } catch (error) {
          // Suppress 401 errors as they're handled by axios interceptor
          if (error.response?.status !== 401) {
            toast.error(getApiErrorMessage(error, "Failed to load restaurant profile"))
            debugError('Error fetching restaurant data:', error)
          }
        }
      }
      fetchRestaurantData()
    }
  }, [financeData])

  // Format restaurant ID to REST###### format (e.g., REST000001)
  const formatRestaurantId = (restaurant) => {
    // If the whole object is passed, check for restaurantId field
    if (restaurant?.restaurantId) return `#${restaurant.restaurantId}`
    
    // If just the ID string is passed or fallback
    const restaurantId = typeof restaurant === 'string' ? restaurant : (restaurant?._id || restaurant?.id)
    if (!restaurantId) return ''
    
    // Extract numeric part from the end (e.g., "REST-1768762345335-5678" -> "5678")
    const strId = String(restaurantId)
    const numericMatch = strId.match(/(\d+)$/)
    
    if (numericMatch) {
      const numericPart = numericMatch[1]
      // Take last 6 digits and pad with zeros if needed
      const lastDigits = numericPart.slice(-6).padStart(6, '0')
      return `REST${lastDigits}`
    }
    
    // Fallback: if no numeric part found, use original
    return strId
  }

  // Get current cycle dates from API response or use default
  const currentCycleDates = useMemo(() => {
    if (financeData?.currentCycle) {
      return {
        start: financeData.currentCycle.start.day,
        end: financeData.currentCycle.end.day,
        month: financeData.currentCycle.start.month,
        year: financeData.currentCycle.start.year
      }
    }
    return {
      start: "15",
      end: "21",
      month: "Dec",
      year: "25"
    }
  }, [financeData])

  const invoiceOrders = useMemo(() => {
    const allOrdersMap = new Map()
    
    // Add current cycle orders first
    const current = financeData?.currentCycle?.orders || []
    current.forEach(order => {
      const id = order.orderId || order._id || order.id
      if (id) {
        allOrdersMap.set(id, order)
      }
    })
    
    // Add past cycles orders, avoiding duplicates already in current map
    const past = pastCyclesData?.orders || []
    past.forEach(order => {
      const id = order.orderId || order._id || order.id
      if (id && !allOrdersMap.has(id)) {
        allOrdersMap.set(id, order)
      }
    })
    
    return Array.from(allOrdersMap.values())
  }, [financeData, pastCyclesData])

  const invoiceSummary = useMemo(() => {
    const earnings = invoiceOrders.reduce((sum, order) => sum + (order.payout || order.restaurantEarning || 0), 0)
    // Restaurant gross = item subtotal + packaging. Never the customer total, which
    // also carries delivery + platform fees that belong to the platform.
    const gross = invoiceOrders.reduce(
      (sum, order) =>
        sum +
        (Number(order.restaurantGross ?? 0) ||
          Number(order.payout ?? order.restaurantEarning ?? 0) + Number(order.commission ?? 0)),
      0,
    )
    const commission = RESTAURANT_COMMISSION_ENABLED
      ? invoiceOrders.reduce(
          (sum, order) =>
            sum + (order.commission || Math.max(0, Number(order.totalAmount || 0) - Number(order.payout || order.restaurantEarning || 0))),
          0,
        )
      : 0
    return { earnings, gross, commission, count: invoiceOrders.length }
  }, [invoiceOrders])

  const currentCycleCommission = useMemo(() => {
    if (!RESTAURANT_COMMISSION_ENABLED) return 0
    const cycleOrders = financeData?.currentCycle?.orders || []
    return cycleOrders.reduce(
      (sum, order) =>
        sum + (order.commission || Math.max(0, Number(order.totalAmount || 0) - Number(order.payout || order.restaurantEarning || 0))),
      0,
    )
  }, [financeData])

  const handleViewDetails = () => {
    navigate("/food/restaurant/finance-details", { state: { financeData, restaurantData } })
  }

  const getWithdrawalStatusClass = (statusRaw) => {
    const status = String(statusRaw || '').trim().toLowerCase()
    if (status === 'approved') return 'bg-green-100 text-green-700'
    if (status === 'rejected') return 'bg-red-100 text-red-700'
    return 'bg-amber-100 text-amber-700'
  }

  const formatWithdrawalStatus = (statusRaw) => {
    const status = String(statusRaw || '').trim().toLowerCase()
    if (!status) return 'Pending'
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  const formatDateTime = (dateValue) => {
    if (!dateValue) return 'N/A'
    const date = new Date(dateValue)
    if (Number.isNaN(date.getTime())) return 'N/A'
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  // Parse date range string to extract start and end dates
  const parseDateRange = (dateRangeStr) => {
    try {
      if (!dateRangeStr || typeof dateRangeStr !== 'string') return null;

      // Handle relative ranges
      const today = new Date();
      if (dateRangeStr === "Last 7 days") {
        const start = new Date();
        start.setDate(today.getDate() - 7);
        return { startDate: start.toISOString(), endDate: today.toISOString() };
      }
      if (dateRangeStr === "Last 30 days" || dateRangeStr === "Last 1 month") {
        const start = new Date();
        start.setDate(today.getDate() - 30);
        return { startDate: start.toISOString(), endDate: today.toISOString() };
      }
      if (dateRangeStr === "This week") {
        const start = new Date();
        const day = today.getDay();
        start.setDate(today.getDate() - day);
        return { startDate: start.toISOString(), endDate: today.toISOString() };
      }
      if (dateRangeStr === "This month") {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        return { startDate: start.toISOString(), endDate: today.toISOString() };
      }

      const parts = dateRangeStr.split(' - ')
      if (parts.length !== 2) return null
      
      const startStr = parts[0].trim() // "14 Nov"
      const endStr = parts[1].trim().replace("'", " ") // "14 Dec 25"
      
      const currentYear = new Date().getFullYear()
      const startParts = startStr.split(' ')
      const endParts = endStr.split(' ')
      
      if (startParts.length < 2 || endParts.length < 2) return null
      
      const monthMap = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      }
      
      const startDay = parseInt(startParts[0])
      const startMonth = monthMap[startParts[1]]
      const endDay = parseInt(endParts[0])
      const endMonth = monthMap[endParts[1]]
      const year = endParts.length > 2 ? parseInt('20' + endParts[2]) : currentYear
      
      if (startMonth === undefined || endMonth === undefined || isNaN(startDay) || isNaN(endDay)) {
        return null
      }
      
      const start = new Date(year, startMonth, startDay)
      const end = new Date(year, endMonth, endDay)

      return {
        startDate: start.toISOString(),
        endDate: end.toISOString()
      }
    } catch (error) {
      debugError('Error parsing date range:', error)
      return null
    }
  }

  // Fetch past cycles data when date range changes
  const fetchPastCyclesData = async (startDate, endDate) => {
    if (!startDate || !endDate) {
      setPastCyclesData(null)
      return
    }

    try {
      setLoadingPastCycles(true)
      // Validate dates and format as ISO strings
      const startDateObj = startDate instanceof Date ? startDate : new Date(startDate)
      const endDateObj = endDate instanceof Date ? endDate : new Date(endDate)
      
      // Check if dates are valid
      if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
        debugError('Invalid date values:', { startDate, endDate })
        setPastCyclesData(null)
        return
      }
      
      const startDateISO = startDateObj.toISOString().split('T')[0]
      const endDateISO = endDateObj.toISOString().split('T')[0]
      
      const response = await restaurantAPI.getFinance({
        startDate: startDateISO,
        endDate: endDateISO
      })
      if (response.data?.success && response.data?.data?.pastCycles) {
        setPastCyclesData(response.data.data.pastCycles)
        debugLog('? Past cycles data fetched:', response.data.data.pastCycles)
        debugLog('?? Orders array:', response.data.data.pastCycles?.orders)
        debugLog('?? Total orders:', response.data.data.pastCycles?.totalOrders)
      } else {
        setPastCyclesData(null)
      }
    } catch (error) {
      // Suppress 401 errors as they're handled by axios interceptor (token refresh/redirect)
      if (error.response?.status !== 401) {
        toast.error(getApiErrorMessage(error, "Failed to load past cycle data"))
        debugError('Error fetching past cycles data:', error)
      }
      setPastCyclesData(null)
    } finally {
      setLoadingPastCycles(false)
    }
  }

  // Fetch past cycles data on mount and when date range changes
  useEffect(() => {
    const dateRange = parseDateRange(selectedDateRange)
    if (dateRange && dateRange.startDate && dateRange.endDate) {
      fetchPastCyclesData(dateRange.startDate, dateRange.endDate)
    } else {
      // If date range is invalid, don't fetch
      setPastCyclesData(null)
    }
  }, [selectedDateRange])


  // Prepare report data — past cycles Get Report uses the selected range orders with ledger fields
  const getReportData = () => {
    const restaurantName = financeData?.restaurant?.name || "Restaurant"
    const restaurantId = financeData?.restaurant?.restaurantId || "N/A"

    const sourceOrders =
      pastCyclesData?.orders && Array.isArray(pastCyclesData.orders)
        ? pastCyclesData.orders
        : financeData?.currentCycle?.orders || []

    const allOrders = sourceOrders.map((order) => {
      const payout = Number(order.payout ?? order.restaurantEarning ?? 0) || 0
      const orderTotal = Number(order.orderTotal ?? 0) || 0
      const customerPaid = Number(order.totalAmount ?? 0) || 0
      const commission = RESTAURANT_COMMISSION_ENABLED
        ? Number(order.commission ?? 0) || Math.max(0, customerPaid - payout)
        : 0
      // Restaurant gross = item subtotal + packaging, so it always ties back to
      // earning + commission. Never the customer total (carries platform/delivery fees).
      const restaurantGross = Number(order.restaurantGross ?? 0) || payout + commission
      const items = Array.isArray(order.items) ? order.items : []
      const foodNames =
        order.foodNames ||
        items.map((item) => item.name).filter(Boolean).join(", ") ||
        "N/A"
      const itemQuantities =
        order.itemQuantities ||
        (items.length
          ? items.map((item) => String(item.quantity || 1)).join(", ")
          : "N/A")
      const totalQty =
        Number(order.totalQty) ||
        items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0) ||
        0

      return {
        ...order,
        cycle: selectedDateRange || "Selected range",
        foodNames,
        itemQuantities,
        totalQty,
        orderTotal,
        restaurantGross,
        totalAmount: customerPaid,
        payout,
        restaurantEarning: payout,
        commission,
        paymentMethod: order.paymentMethod || "N/A",
        orderStatus: order.orderStatus || order.status || "N/A",
      }
    })

    const totalEarnings = allOrders.reduce((sum, o) => sum + (Number(o.payout) || 0), 0)
    const totalRestaurantGross = allOrders.reduce((sum, o) => sum + (Number(o.restaurantGross) || 0), 0)
    const totalCommission = allOrders.reduce((sum, o) => sum + (Number(o.commission) || 0), 0)
    const totalCustomerPaid = allOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0)

    return {
      restaurantName,
      restaurantId,
      dateRange: selectedDateRange,
      summary: {
        totalOrders: allOrders.length,
        totalEarnings,
        totalRestaurantGross,
        totalCommission,
        totalCustomerPaid,
      },
      pastCycles: pastCyclesData,
      allOrders,
    }
  }

  // Generate HTML content for the report
  const generateHTMLContent = (reportData) => {
    const fmt = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    const summary = reportData.summary || {}

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Past Cycles Finance Report - ${reportData.dateRange}</title>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 32px;
            color: #333;
            background-color: #fff;
            width: 794px;
            box-sizing: border-box;
          }
          .header {
            text-align: center;
            margin-bottom: 24px;
            border-bottom: 2px solid #333;
            padding-bottom: 16px;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            color: #000;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .header p {
            margin: 4px 0;
            font-size: 13px;
            color: #444;
          }
          .section { margin-bottom: 24px; clear: both; }
          .section-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 12px;
            color: #000;
            border-left: 4px solid #000;
            padding-left: 10px;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 8px;
          }
          .summary-card {
            background: #f8f8f8;
            border: 1px solid #e5e5e5;
            border-radius: 8px;
            padding: 12px;
          }
          .summary-card .label { font-size: 11px; color: #666; margin: 0 0 4px 0; }
          .summary-card .value { font-size: 18px; font-weight: 700; margin: 0; color: #111; }
          .orders-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            margin-top: 12px;
            border: 1px solid #000;
          }
          .orders-table th {
            background-color: #f2f2f2;
            padding: 8px 6px;
            text-align: left;
            border: 1px solid #000;
            font-weight: bold;
            font-size: 9px;
            text-transform: uppercase;
          }
          .orders-table td {
            padding: 8px 6px;
            border: 1px solid #000;
            font-size: 9px;
            word-wrap: break-word;
            vertical-align: top;
          }
          .footer {
            margin-top: 36px;
            padding-top: 16px;
            border-top: 1px solid #000;
            text-align: center;
            font-size: 11px;
            color: #555;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Past Cycles Finance Report</h1>
          <p>${reportData.restaurantName}</p>
          <p>Restaurant ID: ${reportData.restaurantId}</p>
          <p>Period: ${reportData.dateRange}</p>
          <p>Generated on: ${new Date().toLocaleString('en-IN')}</p>
        </div>

        <div class="section">
          <div class="section-title">Summary</div>
          <div class="summary-grid">
            <div class="summary-card">
              <p class="label">Total Orders</p>
              <p class="value">${summary.totalOrders || 0}</p>
            </div>
            <div class="summary-card">
              <p class="label">Restaurant Earnings</p>
              <p class="value">${fmt(summary.totalEarnings)}</p>
            </div>
            <div class="summary-card">
              <p class="label">Restaurant Gross</p>
              <p class="value">${fmt(summary.totalRestaurantGross)}</p>
            </div>
            ${RESTAURANT_COMMISSION_ENABLED ? `
            <div class="summary-card">
              <p class="label">Commission</p>
              <p class="value">${fmt(summary.totalCommission)}</p>
            </div>` : ''}
          </div>
        </div>

        <div class="section">
          <div class="section-title">Detailed Order-wise Report</div>
          ${reportData.allOrders && reportData.allOrders.length > 0 ? `
            <table class="orders-table">
              <thead>
                <tr>
                  <th style="width: 12%;">Order ID</th>
                  <th style="width: 10%;">Date</th>
                  <th style="width: 22%;">Items</th>
                  <th style="width: 6%;">Qty</th>
                  <th style="width: 11%;">Restaurant Gross</th>
                  ${RESTAURANT_COMMISSION_ENABLED ? '<th style="width: 10%;">Commission</th>' : ''}
                  <th style="width: 11%;">Earning</th>
                  <th style="width: 9%;">Payment</th>
                  <th style="width: 9%;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.allOrders.map(order => {
                  const orderDate = order.createdAt
                    ? new Date(order.createdAt).toLocaleDateString('en-IN')
                    : (order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString('en-IN') : 'N/A')
                  const foodItems = order.foodNames || 'N/A'
                  const itemQuantities = order.itemQuantities || String(order.totalQty || 'N/A')
                  const orderValue = Number(order.restaurantGross) || 0
                  const commission = Number(order.commission) || 0
                  const earning = Number(order.payout ?? order.restaurantEarning) || 0

                  return `
                    <tr>
                      <td>${order.orderId || 'N/A'}</td>
                      <td>${orderDate}</td>
                      <td>${foodItems}</td>
                      <td>${itemQuantities}</td>
                      <td>${fmt(orderValue)}</td>
                      ${RESTAURANT_COMMISSION_ENABLED ? `<td>${fmt(commission)}</td>` : ''}
                      <td>${fmt(earning)}</td>
                      <td>${order.paymentMethod || 'N/A'}</td>
                      <td>${order.orderStatus || 'N/A'}</td>
                    </tr>
                  `
                }).join('')}
              </tbody>
              <tfoot>
                <tr style="background-color: #e8f5e9; font-weight: bold;">
                  <td colspan="4" style="text-align: right;">Totals:</td>
                  <td>${fmt(summary.totalRestaurantGross)}</td>
                  ${RESTAURANT_COMMISSION_ENABLED ? `<td>${fmt(summary.totalCommission)}</td>` : ''}
                  <td>${fmt(summary.totalEarnings)}</td>
                  <td colspan="2"></td>
                </tr>
              </tfoot>
            </table>
          ` : `
          <p style="color:#666;font-size:13px;">No orders available for the selected period.</p>
          `}
        </div>

        <div class="footer">
          <p>Auto-generated past-cycles report. Earnings = restaurant share from ledger (food_transactions).</p>
          <p>Orders: ${summary.totalOrders || 0} | Earnings: ${fmt(summary.totalEarnings)} | Restaurant gross: ${fmt(summary.totalRestaurantGross)}</p>
        </div>
      </body>
      </html>
    `
  }

  // Download PDF report - Direct download without print dialog
  const downloadPDF = async () => {
    try {
      setShowDownloadMenu(false)
      
    const reportData = getReportData()
    if (!reportData.allOrders?.length) {
      toast.error("No orders available for the selected period to generate a report")
      return
    }
    const htmlContent = generateHTMLContent(reportData)
    
      debugLog('?? Generating PDF...')
      
      // Create a temporary hidden iframe to render HTML properly
      const iframe = document.createElement('iframe')
      iframe.style.position = 'absolute'
      iframe.style.left = '-9999px'
      iframe.style.top = '0'
      iframe.style.width = '210mm'
      iframe.style.height = '297mm'
      iframe.style.border = 'none'
      document.body.appendChild(iframe)
      
      // Write HTML to iframe
      iframe.contentDocument.open()
      iframe.contentDocument.write(htmlContent)
      iframe.contentDocument.close()
      
      // Wait for iframe content to load
      await new Promise((resolve) => {
        if (iframe.contentDocument.readyState === 'complete') {
          resolve()
        } else {
          iframe.contentWindow.onload = resolve
          setTimeout(resolve, 1000) // Fallback timeout
        }
      })
      
      // Wait a bit more for styles to apply
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Import html2canvas and jsPDF dynamically
      debugLog('?? Loading libraries...')
      const html2canvas = (await import('html2canvas')).default
      const { default: jsPDF } = await import('jspdf')
    
      // Get the body element from iframe
      const iframeBody = iframe.contentDocument.body
      
      debugLog('?? Converting to canvas...')
      // Convert HTML to canvas
      const canvas = await html2canvas(iframeBody, {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: iframeBody.scrollWidth,
        height: iframeBody.scrollHeight
      })
      
      debugLog('? Canvas created:', canvas.width, 'x', canvas.height)
      
      // Remove temporary iframe
      document.body.removeChild(iframe)
    
      // Calculate PDF dimensions
      const imgWidth = 210 // A4 width in mm
      const pageHeight = 297 // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      
      debugLog('?? PDF dimensions:', imgWidth, 'x', imgHeight, 'mm')
      
      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4')
      let heightLeft = imgHeight
      let position = 0
      
      // Add first page
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      
      // Add additional pages if content is longer than one page
      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }
      
      // Download PDF
      const fileName = `finance-report-${reportData.dateRange.replace(/\s+/g, '-').replace(/'/g, '')}_${new Date().toISOString().split("T")[0]}.pdf`
      debugLog('?? Downloading PDF:', fileName)
      pdf.save(fileName)
      debugLog('? PDF downloaded successfully!')
    } catch (error) {
      debugError('? Error downloading PDF:', error)
      debugError('Error details:', error.stack)
      toast.error(`Failed to download PDF: ${error.message}. Please check console for details.`)
    setShowDownloadMenu(false)
    }
  }

  // Close download menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target)) {
        setShowDownloadMenu(false)
      }
    }
    
    if (showDownloadMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDownloadMenu])

  return (
    <div className="min-h-full flex flex-col bg-gray-100 md:bg-slate-50">
      {/* Mobile header */}
      <div className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <p className="truncate text-lg font-bold text-gray-900">
                {restaurantData?.name || financeData?.restaurant?.name || "Restaurant"}
              </p>
              <ChevronDown className="h-4 w-4 shrink-0 text-gray-600" />
            </div>
            <p className="mt-0.5 text-xs text-gray-600">
              {(() => {
                const restaurantId = restaurantData?.restaurantId || financeData?.restaurant?.restaurantId
                const address = restaurantData?.address || financeData?.restaurant?.address || ''
                const parts = []
                if (restaurantId) parts.push(`ID: ${formatRestaurantId(restaurantId)}`)
                if (address) parts.push(address.length > 40 ? address.substring(0, 40) + '...' : address)
                return parts.length > 0 ? parts.join(' • ') : 'Loading...'
              })()}
            </p>
          </div>
          <div className="ml-2 flex items-center gap-1">
            <button className="rounded-full p-2 transition-colors hover:bg-gray-100" onClick={() => navigate("/food/restaurant/withdrawal-history")} title="Withdrawal History">
              <Wallet className="h-5 w-5 text-gray-700" />
            </button>
            <button className="rounded-full p-2 transition-colors hover:bg-gray-100" onClick={() => navigate("/food/restaurant/notifications")}>
              <Bell className="h-5 w-5 text-gray-700" />
            </button>
            <button className="rounded-full p-2 transition-colors hover:bg-gray-100" onClick={() => navigate("/food/restaurant/explore")}>
              <Menu className="h-5 w-5 text-gray-700" />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop header */}
      <div className="sticky top-0 z-40 hidden border-b border-gray-200 bg-white/95 backdrop-blur md:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payouts</h1>
            <p className="mt-1 text-sm text-gray-500">
              {restaurantData?.name || financeData?.restaurant?.name || "Restaurant"} · Manage withdrawals, earnings & invoices
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/food/restaurant/withdrawal-history")}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Wallet className="h-4 w-4" />
            Withdrawal history
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-6xl gap-2 md:max-w-md">
          <button
            onClick={() => setActiveTab("payouts")}
            className={`flex-1 rounded-full px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "payouts"
                ? "bg-black text-white"
                : "border border-gray-300 bg-white text-gray-600"
            }`}
          >
            Payouts
          </button>
          <button
            onClick={() => setActiveTab("invoices")}
            className={`flex-1 rounded-full px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "invoices"
                ? "bg-black text-white"
                : "border border-gray-300 bg-white text-gray-600"
            }`}
          >
            Invoices & Taxes
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-28 pt-6 md:mx-auto md:max-w-6xl md:px-8 md:pb-8 md:pt-6 md:w-full">
        {financeError && !loading && (
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-red-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Couldn’t load finance data</p>
                <p className="text-sm opacity-90">{financeError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => fetchFinanceData()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}

        {activeTab === "payouts" && (
          <div className="space-y-6">
            {/* Top row: balance + stats */}
            <div className="md:grid md:grid-cols-12 md:gap-6">
              <div className="md:col-span-5">
                <h2 className="mb-3 text-base font-bold text-gray-900">Withdrawable balance</h2>
                <div className="rounded-2xl bg-black p-6 text-white shadow-lg md:p-8">
                  {loading ? (
                    <div className="py-8 text-center text-gray-400">Loading...</div>
                  ) : financeError ? (
                    <div className="py-6 text-center">
                      <p className="mb-3 text-sm text-gray-400">Balance unavailable</p>
                      <button
                        type="button"
                        onClick={() => fetchFinanceData()}
                        className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-black"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Retry
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="mb-1 text-sm text-gray-400">Available for withdrawal</p>
                      <p className="mb-2 text-4xl font-black md:text-5xl">
                        ₹{availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="mb-1 text-xs font-medium text-gray-400 opacity-80">
                        Limit: Min ₹{minWithdrawalLimit.toLocaleString('en-IN')}
                        {maxWithdrawalLimit != null ? ` • Max ₹${maxWithdrawalLimit.toLocaleString('en-IN')}` : ''}
                      </p>
                      {maxWithdrawalLimit != null && availableBalance > maxWithdrawalLimit && (
                        <p className="mb-6 text-xs font-semibold text-amber-300">
                          You can withdraw up to ₹{maxAllowedWithdrawal.toLocaleString('en-IN')} per request
                        </p>
                      )}
                      {!(maxWithdrawalLimit != null && availableBalance > maxWithdrawalLimit) && (
                        <div className="mb-6" />
                      )}
                      <button
                        onClick={() => {
                          setWithdrawalAmount(
                            maxAllowedWithdrawal >= minWithdrawalLimit
                              ? String(Number(maxAllowedWithdrawal.toFixed(2)))
                              : ''
                          )
                          setShowWithdrawalModal(true)
                        }}
                        disabled={!canOpenWithdraw}
                        className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-4 font-bold transition-all ${
                          canOpenWithdraw
                            ? "bg-white text-black hover:bg-gray-100 active:scale-95"
                            : "cursor-not-allowed bg-gray-800 text-gray-500"
                        }`}
                      >
                        <Wallet className="h-5 w-5" />
                        Withdraw funds
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 md:col-span-7 md:mt-0 md:grid-cols-2 md:content-start">
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Current cycle</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ₹{(financeData?.currentCycle?.totalEarnings || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{financeData?.currentCycle?.totalOrders || 0} orders</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Lifetime earnings</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ₹{(financeData?.earnings?.totalEarnings || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Orders ₹{(financeData?.earnings?.totalOrderEarnings || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {" · "}
                    Referrals ₹{(financeData?.earnings?.walletLedger?.totalEarnings ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Pending payout</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ₹{(financeData?.earnings?.pendingPayout || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">Total unsettled share</p>
                </div>
                {RESTAURANT_COMMISSION_ENABLED && (
                  <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Cycle commission</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ₹{currentCycleCommission.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">Current cycle platform commission</p>
                  </div>
                )}
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between h-full">
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Referral balance</p>
                      <p className="text-2xl font-bold text-gray-900">
                        ₹{(financeData?.earnings?.referralEarnings || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        From {referralStats?.referralCount || 0} approved referrals
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button
                        onClick={() => navigate("/food/restaurant/refer-earn")}
                        className="text-sm font-medium text-red-600 hover:underline"
                      >
                        Refer more
                      </button>
                      <div className="rounded-full bg-red-50 p-3">
                        <Gift className="h-6 w-6 text-red-600" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Withdrawal requests + past cycles on desktop */}
            <div className="md:grid md:grid-cols-2 md:gap-6 md:items-start">
            <div>
              <h2 className="mb-3 text-base font-bold text-gray-900">Withdrawal requests</h2>
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:p-5">
                {loadingWithdrawals ? (
                  <div className="py-6 text-center text-sm text-gray-500">Loading withdrawal requests...</div>
                ) : withdrawalRequests.length === 0 ? (
                  <div className="py-6 text-center text-sm text-gray-500">
                    {withdrawalsError ? (
                      <div className="space-y-2">
                        <p className="text-red-600">{withdrawalsError}</p>
                        <button
                          type="button"
                          onClick={() => fetchWithdrawals()}
                          className="text-sm font-medium text-red-600 underline"
                        >
                          Retry
                        </button>
                      </div>
                    ) : (
                      "No withdrawal requests found."
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {withdrawalRequests.slice(0, 8).map((request, index) => {
                      const status = formatWithdrawalStatus(request?.status)
                      return (
                        <div
                          key={request?._id || request?.id || index}
                          className="border border-gray-200 rounded-lg p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                ₹{Number(request?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                Requested: {formatDateTime(request?.createdAt || request?.requestedAt)}
                              </p>
                              {request?.processedAt ? (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Processed: {formatDateTime(request?.processedAt)}
                                </p>
                              ) : null}
                            </div>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getWithdrawalStatusClass(request?.status)}`}>
                              {status}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    {withdrawalRequests.length > 8 ? (
                      <button
                        type="button"
                        onClick={() => navigate("/food/restaurant/withdrawal-history")}
                        className="w-full text-sm font-medium text-black hover:underline pt-1"
                      >
                        View all requests
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            {/* Past cycles */}
            <div>
              <h2 className="mb-3 text-base font-bold text-gray-900">Past cycles</h2>
              <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:p-5">
                <div className="flex gap-2">
                  <div className="flex-1 relative" ref={dateRangePickerRef}>
                    <button 
                      onClick={() => setShowDateRangePicker(!showDateRangePicker)}
                      className="w-full bg-white rounded-lg px-4 py-3 flex items-center justify-between border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer"
                    >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-900">{selectedDateRange}</span>
                    </div>
                      <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${showDateRangePicker ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {/* Date Range Picker Dropdown */}
                    <AnimatePresence>
                      {showDateRangePicker && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
                        >
                          <div className="p-4">
                            <h3 className="text-sm font-semibold text-gray-900 mb-3">Select Date Range</h3>
                            <div className="space-y-2">
                              {(() => {
                                const getDateRanges = () => {
                                  const today = new Date()
                                  today.setHours(23, 59, 59, 999)
                                  
                                  // Last 7 days
                                  const last7DaysStart = new Date(today)
                                  last7DaysStart.setDate(today.getDate() - 7)
                                  last7DaysStart.setHours(0, 0, 0, 0)
                                  
                                  // Last 30 days
                                  const last30DaysStart = new Date(today)
                                  last30DaysStart.setDate(today.getDate() - 30)
                                  last30DaysStart.setHours(0, 0, 0, 0)
                                  
                                  // This week (Monday to Sunday)
                                  const currentDay = today.getDay()
                                  const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1
                                  const thisWeekStart = new Date(today)
                                  thisWeekStart.setDate(today.getDate() - daysFromMonday)
                                  thisWeekStart.setHours(0, 0, 0, 0)
                                  const thisWeekEnd = new Date(thisWeekStart)
                                  thisWeekEnd.setDate(thisWeekStart.getDate() + 6)
                                  thisWeekEnd.setHours(23, 59, 59, 999)
                                  
                                  // Last week
                                  const lastWeekStart = new Date(thisWeekStart)
                                  lastWeekStart.setDate(thisWeekStart.getDate() - 7)
                                  const lastWeekEnd = new Date(thisWeekEnd)
                                  lastWeekEnd.setDate(thisWeekEnd.getDate() - 7)
                                  
                                  // This month
                                  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
                                  const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999)
                                  
                                  // Last month
                                  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
                                  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999)
                                  
                                  return {
                                    today,
                                    last7DaysStart,
                                    last30DaysStart,
                                    thisWeekStart,
                                    thisWeekEnd,
                                    lastWeekStart,
                                    lastWeekEnd,
                                    thisMonthStart,
                                    thisMonthEnd,
                                    lastMonthStart,
                                    lastMonthEnd
                                  }
                                }
                                
                                const formatDateForDisplay = (date) => {
                                  const day = date.getDate()
                                  const month = date.toLocaleString('en-US', { month: 'short' })
                                  const year = date.getFullYear().toString().slice(-2)
                                  return `${day} ${month}'${year}`
                                }
                                
                                const formatDateRange = (start, end) => {
                                  return `${formatDateForDisplay(start)} - ${formatDateForDisplay(end)}`
                                }
                                
                                const ranges = getDateRanges()
                                const dateOptions = [
                                  { 
                                    label: "Last 7 days", 
                                    range: formatDateRange(ranges.last7DaysStart, ranges.today),
                                    startDate: ranges.last7DaysStart,
                                    endDate: ranges.today
                                  },
                                  { 
                                    label: "Last 30 days", 
                                    range: formatDateRange(ranges.last30DaysStart, ranges.today),
                                    startDate: ranges.last30DaysStart,
                                    endDate: ranges.today
                                  },
                                  { 
                                    label: "This week", 
                                    range: formatDateRange(ranges.thisWeekStart, ranges.thisWeekEnd),
                                    startDate: ranges.thisWeekStart,
                                    endDate: ranges.thisWeekEnd
                                  },
                                  { 
                                    label: "Last week", 
                                    range: formatDateRange(ranges.lastWeekStart, ranges.lastWeekEnd),
                                    startDate: ranges.lastWeekStart,
                                    endDate: ranges.lastWeekEnd
                                  },
                                  { 
                                    label: "This month", 
                                    range: formatDateRange(ranges.thisMonthStart, ranges.thisMonthEnd),
                                    startDate: ranges.thisMonthStart,
                                    endDate: ranges.thisMonthEnd
                                  },
                                  { 
                                    label: "Last month", 
                                    range: formatDateRange(ranges.lastMonthStart, ranges.lastMonthEnd),
                                    startDate: ranges.lastMonthStart,
                                    endDate: ranges.lastMonthEnd
                                  }
                                ]
                                
                                return dateOptions.map((option, index) => (
                                  <button
                                    key={index}
                                    onClick={() => {
                                      setSelectedDateRange(option.range)
                                      setShowDateRangePicker(false)
                                      // Fetch data for selected range
                                      fetchPastCyclesData(option.startDate, option.endDate)
                                    }}
                                    className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors text-sm"
                                  >
                                    <div className="font-medium text-gray-900">{option.label}</div>
                                    <div className="text-xs text-gray-500">{option.range}</div>
                  </button>
                                ))
                              })()}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="relative" ref={downloadMenuRef}>
                    <button 
                      onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                      className="bg-[#0D315B] text-white rounded-lg px-4 py-3 flex items-center justify-center gap-2 hover:bg-[#0A2647] transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span className="text-sm font-medium">Get report</span>
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    
                    <AnimatePresence>
                      {showDownloadMenu && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 z-50 min-w-[180px]"
                        >
                          <button
                            onClick={downloadPDF}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <div className="w-6 h-6 rounded-md bg-red-50 flex items-center justify-center">
                              <FileText className="w-4 h-4 text-red-600" />
                            </div>
                            <span>Download PDF</span>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                {loadingPastCycles ? (
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-gray-600 text-center">Loading past cycles...</p>
                  </div>
                ) : (
                  <>
                    {/* Show past cycles orders if available */}
                    {pastCyclesData && pastCyclesData.orders && pastCyclesData.orders.length > 0 ? (
                      <div className="bg-white rounded-lg p-4 space-y-3">
                        {pastCyclesData.orders.map((order, index) => (
                          <div key={order.orderId || index} className="border-b border-gray-200 pb-3 last:border-b-0 last:pb-0">
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 mb-1">
                                  Order ID: {order.orderId || 'N/A'}
                                </p>
                                <p className="text-xs text-gray-600 truncate">
                                  {order.foodNames || (order.items && order.items.map(item => item.name).join(', ')) || 'N/A'}
                                </p>
                                <p className="text-[11px] text-gray-500 mt-1">
                                  {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : 'N/A'}
                                  {' · '}Qty {order.itemQuantities || order.totalQty || '—'}
                                  {' · '}Gross ₹{(
                                    Number(order.restaurantGross ?? 0) ||
                                    Number(order.payout ?? order.restaurantEarning ?? 0) + Number(order.commission ?? 0)
                                  ).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                              </div>
                              <div className="text-right ml-4 shrink-0">
                                <p className="text-sm font-bold text-gray-900">
                                  ₹{(Number(order.payout) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Earning
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (pastCyclesData && pastCyclesData.orders && pastCyclesData.orders.length === 0) ? (
                      <div className="bg-white rounded-lg p-8 text-center border border-dashed border-gray-300">
                        <p className="text-sm text-gray-500 italic">No orders found for this selected range.</p>
                      </div>
                    ) : null}

                    {/* Show current cycle orders if past cycles data is not requested or not being viewed */}
                    {(!pastCyclesData || !pastCyclesData.orders) && !loadingPastCycles && financeData?.currentCycle?.orders && financeData.currentCycle.orders.length > 0 && (
                      <div className="bg-white rounded-lg p-4 space-y-3">
                        {financeData.currentCycle.orders.map((order, index) => (
                          <div key={order.orderId || index} className="border-b border-gray-200 pb-3 last:border-b-0 last:pb-0">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-900 mb-1">
                                  Order ID: {order.orderId || 'N/A'}
                                </p>
                                <p className="text-xs text-gray-600">
                                  {order.foodNames || (order.items && order.items.map(item => item.name).join(', ')) || 'N/A'}
                                </p>
                              </div>
                              <div className="text-right ml-4">
                                <p className="text-sm font-bold text-gray-900">
                                  ₹{(order.payout || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Earning
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {(!pastCyclesData || (!pastCyclesData.orders || pastCyclesData.orders.length === 0)) && 
                     (!financeData?.currentCycle?.orders || financeData.currentCycle.orders.length === 0) && 
                     !loadingPastCycles && !loading && (
                      <div className="bg-white rounded-lg p-12 text-center border border-gray-200">
                        <p className="text-gray-400 mb-2">No transaction history available</p>
                        <p className="text-xs text-gray-500">Your earnings and order payouts will appear here.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            </div>
          </div>
        )}

        {activeTab === "invoices" && (
          <div className="space-y-4 md:rounded-2xl md:border md:border-gray-200 md:bg-white md:p-6 md:shadow-sm">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Invoices & Taxes Summary</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-xs text-gray-600">Orders</p>
                  <p className="text-base font-semibold text-gray-900">{invoiceSummary.count}</p>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-xs text-gray-600">Earnings</p>
                  <p className="text-base font-semibold text-gray-900">₹{invoiceSummary.earnings.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-xs text-gray-600">Gross amount</p>
                  <p className="text-base font-semibold text-gray-900">₹{invoiceSummary.gross.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                {RESTAURANT_COMMISSION_ENABLED && (
                  <div className="rounded-md bg-gray-50 p-3">
                    <p className="text-xs text-gray-600">Commission</p>
                    <p className="text-base font-semibold text-gray-900">₹{invoiceSummary.commission.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Order invoice details</h3>
              {loading ? (
                <p className="text-sm text-gray-500">Loading invoice data...</p>
              ) : invoiceOrders.length === 0 ? (
                <p className="text-sm text-gray-500">No invoice data available for selected range.</p>
              ) : (
                <div className="space-y-2">
                  {invoiceOrders.map((order, index) => (
                    <div key={`${order.orderId || index}-invoice`} className="border border-gray-100 rounded-md p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Order: {order.orderId || "N/A"}</p>
                          <p className="text-xs text-gray-600 mt-0.5">
                            {order.paymentMethod || "N/A"} | {order.orderStatus || "N/A"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">
                            ₹{(
                              Number(order.restaurantGross ?? 0) ||
                              Number(order.payout ?? order.restaurantEarning ?? 0) + Number(order.commission ?? 0)
                            ).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-gray-500">Restaurant gross</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Withdrawal Modal */}
      <AnimatePresence>
        {showWithdrawalModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setShowWithdrawalModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Withdraw Amount</h2>
                  <button
                    onClick={() => {
                      setShowWithdrawalModal(false)
                      setWithdrawalAmount('')
                    }}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
                
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">
                    Available Balance:{' '}
                    <span className="font-semibold text-gray-900">
                      ₹{availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 mb-1">
                    Min: ₹{minWithdrawalLimit.toLocaleString('en-IN')}
                    {maxWithdrawalLimit != null
                      ? ` · Max: ₹${maxWithdrawalLimit.toLocaleString('en-IN')}`
                      : ' · Max: Unlimited'}
                  </p>
                  <p className="text-xs font-semibold text-slate-700 mb-3">
                    Enter any amount between ₹{minWithdrawalLimit.toLocaleString('en-IN')} and ₹{maxAllowedWithdrawal.toLocaleString('en-IN')}
                  </p>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter Amount to Withdraw
                  </label>
                  <input
                    type="number"
                    min={minWithdrawalLimit}
                    max={maxAllowedWithdrawal}
                    step="0.01"
                    value={withdrawalAmount}
                    onChange={(e) => {
                      const raw = e.target.value
                      if (raw === '' || raw === '.') {
                        setWithdrawalAmount(raw)
                        return
                      }
                      const n = Number(raw)
                      if (!Number.isFinite(n)) return
                      // Soft-clamp while typing above max allowed
                      if (n > maxAllowedWithdrawal) {
                        setWithdrawalAmount(String(Number(maxAllowedWithdrawal.toFixed(2))))
                        return
                      }
                      setWithdrawalAmount(raw)
                    }}
                    placeholder={`${minWithdrawalLimit} - ${maxAllowedWithdrawal}`}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                  />
                  {withdrawalAmount && parseFloat(withdrawalAmount) > availableBalance && (
                    <p className="text-sm text-red-600 mt-1">Amount cannot exceed available balance</p>
                  )}
                  {withdrawalAmount && parseFloat(withdrawalAmount) > 0 && parseFloat(withdrawalAmount) < minWithdrawalLimit && (
                    <p className="text-sm text-red-600 mt-1">Minimum withdrawal amount is ₹{minWithdrawalLimit}</p>
                  )}
                  {withdrawalAmount && maxWithdrawalLimit != null && parseFloat(withdrawalAmount) > maxWithdrawalLimit && (
                    <p className="text-sm text-red-600 mt-1">Maximum withdrawal amount is ₹{maxWithdrawalLimit}</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowWithdrawalModal(false)
                      setWithdrawalAmount('')
                    }}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      const amount = parseFloat(withdrawalAmount)
                      if (!amount || amount <= 0) {
                        toast.error('Please enter a valid amount')
                        return
                      }
                      if (amount < minWithdrawalLimit) {
                        toast.error(`Minimum withdrawal amount is ₹${minWithdrawalLimit}`)
                        return
                      }
                      if (maxWithdrawalLimit != null && amount > maxWithdrawalLimit) {
                        toast.error(`Maximum withdrawal amount is ₹${maxWithdrawalLimit}`)
                        return
                      }
                      if (amount > availableBalance) {
                        toast.error('Amount cannot exceed available balance')
                        return
                      }
                      if (amount > maxAllowedWithdrawal) {
                        toast.error(`You can withdraw maximum ₹${maxAllowedWithdrawal} in one request`)
                        return
                      }
                      
                      try {
                        setSubmittingWithdrawal(true)
                        const idempotencyKey =
                          (typeof crypto !== "undefined" && crypto.randomUUID)
                            ? crypto.randomUUID()
                            : `wd_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
                        const response = await restaurantAPI.createWithdrawalRequest(amount, {
                          idempotencyKey,
                        })
                        if (response.data?.success) {
                          toast.success('Withdrawal request submitted successfully!')
                          setShowWithdrawalModal(false)
                          setWithdrawalAmount('')
                          await Promise.all([fetchFinanceData(), fetchWithdrawals()])
                        } else {
                          toast.error(response.data?.message || 'Failed to submit withdrawal request')
                        }
                      } catch (error) {
                        if (error?.response?.status !== 401) {
                          toast.error(
                            getApiErrorMessage(
                              error,
                              "Failed to submit withdrawal request. Please try again.",
                            ),
                          )
                          debugError("Error submitting withdrawal request:", error)
                        }
                      } finally {
                        setSubmittingWithdrawal(false)
                      }
                    }}
                    disabled={
                      submittingWithdrawal ||
                      !withdrawalAmount ||
                      parseFloat(withdrawalAmount) <= 0 ||
                      parseFloat(withdrawalAmount) < minWithdrawalLimit ||
                      (maxWithdrawalLimit != null && parseFloat(withdrawalAmount) > maxWithdrawalLimit) ||
                      parseFloat(withdrawalAmount) > availableBalance ||
                      parseFloat(withdrawalAmount) > maxAllowedWithdrawal
                    }
                    className="flex-1 px-4 py-3 bg-[#0D315B] text-white rounded-lg font-medium hover:bg-[#0A2647] transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {submittingWithdrawal ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="md:hidden">
        <BottomNavOrders />
      </div>
    </div>
  )
}

