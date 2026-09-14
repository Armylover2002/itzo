import { useEffect, useState } from "react";
import { Loader2, IndianRupee, Calendar, TrendingUp, Layers } from "lucide-react";
import { toast } from "sonner";
import { adminAPI } from "@food/api";

const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-500",
  finalized: "bg-amber-100 text-amber-700",
  paid: "bg-blue-100 text-blue-700",
  settled: "bg-green-100 text-green-700",
};

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-[#FF0000]">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

export default function DiningBills() {
  const [bills, setBills] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [billsRes, statsRes] = await Promise.all([
          adminAPI.getDiningBills({ status: status || undefined, limit: 50 }),
          adminAPI.getDiningRevenueStats(),
        ]);
        setBills(billsRes?.data?.data?.items || []);
        setStats(statsRes?.data?.data || null);
      } catch {
        toast.error("Failed to load dining bills");
      } finally {
        setLoading(false);
      }
    })();
  }, [status]);

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-xl font-bold text-gray-900 sm:text-2xl">Dining Bills</h1>
      <p className="mb-5 text-sm text-gray-500">Revenue and billing history across all dining bookings</p>

      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={IndianRupee} label="Total revenue" value={`₹${stats.totalRevenue}`} />
          <StatCard icon={TrendingUp} label="Platform commission" value={`₹${stats.totalCommission}`} />
          <StatCard icon={Layers} label="Restaurant payout" value={`₹${stats.totalPayout}`} />
          <StatCard icon={Calendar} label="Bookings today" value={stats.bookingsToday ?? 0} />
        </div>
      )}

      <div className="mb-4">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="finalized">Finalized</option>
          <option value="paid">Paid</option>
          <option value="settled">Settled</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : bills.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center text-gray-500">No bills found.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Restaurant</th>
                <th className="px-4 py-3">Guest</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Commission</th>
                <th className="px-4 py-3">Payout</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bills.map((bill) => (
                <tr key={bill._id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{bill.restaurant?.name || bill.reservation?.restaurantNameSnapshot || "—"}</div>
                    <div className="font-mono text-[11px] text-gray-400">{bill._id.slice(-8)}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {bill.reservation?.userNameSnapshot || "—"}
                    {bill.reservation?.userPhoneSnapshot && <div className="text-[11px] text-gray-400">{bill.reservation.userPhoneSnapshot}</div>}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">₹{bill.grandTotal}</td>
                  <td className="px-4 py-3 text-gray-600">₹{bill.commission?.amount || 0}</td>
                  <td className="px-4 py-3 text-gray-600">₹{bill.restaurantPayout}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[bill.status] || "bg-gray-100 text-gray-500"}`}>
                      {bill.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
