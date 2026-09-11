import { useEffect, useMemo, useState, Fragment } from "react"
import { IndianRupee, Loader2, Receipt, TrendingUp, Wallet, ChevronDown, ChevronUp } from "lucide-react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"

const STATUS_OPTIONS = ["", "draft", "finalized", "paid", "settled"]

const statusBadgeClass = (status) => {
  switch (status) {
    case "finalized": return "bg-amber-50 text-amber-700 border-amber-200"
    case "paid": return "bg-blue-50 text-blue-700 border-blue-200"
    case "settled": return "bg-emerald-50 text-emerald-700 border-emerald-200"
    default: return "bg-slate-100 text-slate-600 border-slate-200"
  }
}

const StatCard = ({ icon: Icon, label, value, accent }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center gap-3">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  </div>
)

export default function DiningBills() {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState("")
  const [stats, setStats] = useState(null)
  const [expandedBillId, setExpandedBillId] = useState(null)

  const fetchBills = async () => {
    try {
      setLoading(true)
      const params = { limit: 200 }
      if (status) params.status = status
      const response = await adminAPI.getDiningBills(params)
      const list = response?.data?.data?.bills || []
      setBills(Array.isArray(list) ? list : [])
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load bills")
      setBills([])
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await adminAPI.getDiningRevenueStats()
      setStats(response?.data?.data?.stats || null)
    } catch {
      setStats(null)
    }
  }

  useEffect(() => { fetchBills() }, [status])
  useEffect(() => { fetchStats() }, [])

  const totalCommission = useMemo(() => bills.reduce((sum, b) => sum + (b?.commission?.amount || 0), 0), [bills])

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Dining Bills &amp; Revenue</h1>
        <p className="mt-1 text-sm text-slate-500">Every dine-in bill across restaurants, with the platform's commission earned.</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={IndianRupee} label="Total Revenue" value={`₹${(stats?.totalRevenue ?? 0).toLocaleString("en-IN")}`} accent="bg-blue-50 text-blue-600" />
        <StatCard icon={TrendingUp} label="Commission Earned" value={`₹${(stats?.totalCommission ?? 0).toLocaleString("en-IN")}`} accent="bg-emerald-50 text-emerald-600" />
        <StatCard icon={Wallet} label="Restaurant Payout" value={`₹${(stats?.totalRestaurantPayout ?? 0).toLocaleString("en-IN")}`} accent="bg-violet-50 text-violet-600" />
        <StatCard icon={Receipt} label="Bookings Today" value={stats?.bookingsToday ?? 0} accent="bg-amber-50 text-amber-600" />
      </div>

      <div className="mb-4 flex items-center justify-end">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-slate-900"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt || "all"} value={opt}>{opt ? opt.charAt(0).toUpperCase() + opt.slice(1) : "All statuses"}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="w-[22%] px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">Restaurant</th>
                <th className="w-[18%] px-4 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">Guest</th>
                <th className="w-[13%] px-4 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-600">Bill Total</th>
                <th className="w-[13%] px-4 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-600">Commission</th>
                <th className="w-[13%] px-4 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-600">Payout</th>
                <th className="w-[11%] px-4 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-slate-600">Status</th>
                <th className="w-[10%] px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-600">Date</th>
                <th className="w-[5%] px-4 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-20 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                </td></tr>
              ) : bills.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-20 text-center">
                  <p className="text-lg font-semibold text-slate-700">No bills found</p>
                </td></tr>
              ) : (
                bills.map((bill) => (
                  <Fragment key={bill._id}>
                    <tr 
                      onClick={() => setExpandedBillId(prev => prev === bill._id ? null : bill._id)}
                      className={`cursor-pointer transition-colors ${expandedBillId === bill._id ? "bg-slate-50" : "hover:bg-slate-50/80"}`}
                    >
                      <td className="px-5 py-4 text-sm font-medium text-slate-900">{bill.restaurant?.restaurantName || "-"}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        <p className="font-medium text-slate-800">{bill.reservation?.userNameSnapshot || "-"}</p>
                        <p className="text-xs text-slate-400">{bill.reservation?.userPhoneSnapshot || ""}</p>
                      </td>
                      <td className="px-4 py-4 text-right text-sm font-semibold text-slate-900">₹{bill.grandTotal?.toLocaleString("en-IN") ?? 0}</td>
                      <td className="px-4 py-4 text-right text-sm text-emerald-700">
                        ₹{bill.commission?.amount?.toLocaleString("en-IN") ?? 0}
                        <span className="ml-1 text-xs text-slate-400">
                          ({bill.commission?.type === "percentage" ? `${bill.commission?.value}%` : `₹${bill.commission?.value}`})
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-sm text-slate-700">₹{bill.restaurantPayout?.toLocaleString("en-IN") ?? 0}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${statusBadgeClass(bill.status)}`}>
                          {bill.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-xs text-slate-400">
                        {bill.createdAt ? new Date(bill.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "-"}
                      </td>
                      <td className="px-4 py-4 text-center text-slate-400">
                        {expandedBillId === bill._id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </td>
                    </tr>
                    {expandedBillId === bill._id && (
                      <tr>
                        <td colSpan={8} className="bg-slate-50/50 p-6 border-b border-slate-200">
                          <div className="flex flex-col md:flex-row gap-8">
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-slate-800 mb-3">Order Items</h4>
                              {bill.items && bill.items.length > 0 ? (
                                <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                                  <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                                      <tr>
                                        <th className="px-4 py-2 font-medium">Item</th>
                                        <th className="px-4 py-2 font-medium text-center">Qty</th>
                                        <th className="px-4 py-2 font-medium text-right">Price</th>
                                        <th className="px-4 py-2 font-medium text-right">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {bill.items.map((item, idx) => (
                                        <tr key={idx}>
                                          <td className="px-4 py-2 text-slate-700">{item.name}</td>
                                          <td className="px-4 py-2 text-center text-slate-600">{item.quantity}</td>
                                          <td className="px-4 py-2 text-right text-slate-600">₹{item.price?.toLocaleString("en-IN")}</td>
                                          <td className="px-4 py-2 text-right font-medium text-slate-800">₹{item.total?.toLocaleString("en-IN")}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-sm text-slate-500 italic">No items recorded</p>
                              )}
                            </div>
                            
                            <div className="w-full md:w-72 flex flex-col gap-4">
                              <div className="rounded-lg border border-slate-200 bg-white p-4">
                                <h4 className="text-sm font-semibold text-slate-800 mb-3 border-b border-slate-100 pb-2">Billing Summary</h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between text-slate-600">
                                    <span>Subtotal</span>
                                    <span>₹{bill.subtotal?.toLocaleString("en-IN") ?? 0}</span>
                                  </div>
                                  <div className="flex justify-between text-slate-600">
                                    <span>Tax {bill.taxPercent > 0 ? `(${bill.taxPercent}%)` : ""}</span>
                                    <span>₹{bill.taxAmount?.toLocaleString("en-IN") ?? 0}</span>
                                  </div>
                                  {bill.discount > 0 && (
                                    <div className="flex justify-between text-emerald-600">
                                      <span>Discount</span>
                                      <span>- ₹{bill.discount?.toLocaleString("en-IN")}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between font-bold text-slate-900 border-t border-slate-100 pt-2 mt-2">
                                    <span>Grand Total</span>
                                    <span>₹{bill.grandTotal?.toLocaleString("en-IN") ?? 0}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="rounded-lg border border-slate-200 bg-white p-4">
                                <h4 className="text-sm font-semibold text-slate-800 mb-3 border-b border-slate-100 pb-2">Payment Details</h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">Status</span>
                                    <span className={`font-medium capitalize ${bill.payment?.status === "paid" ? "text-emerald-600" : "text-amber-600"}`}>
                                      {bill.payment?.status || "Pending"}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">Method</span>
                                    <span className="font-medium text-slate-700 capitalize">{bill.payment?.method || "-"}</span>
                                  </div>
                                  {bill.payment?.razorpay?.paymentId && (
                                    <div className="flex flex-col mt-1">
                                      <span className="text-xs text-slate-400">Transaction ID</span>
                                      <span className="text-xs font-mono text-slate-600 break-all">{bill.payment.razorpay.paymentId}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {bills.length > 0 && (
        <p className="mt-3 text-right text-xs text-slate-400">Commission on this page: ₹{totalCommission.toLocaleString("en-IN")}</p>
      )}
    </div>
  )
}
