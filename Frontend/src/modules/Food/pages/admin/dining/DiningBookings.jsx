import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminAPI } from "@food/api";

const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  seated: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
  no_show: "bg-red-100 text-red-700",
};

export default function DiningBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await adminAPI.getDiningBookings({ status: status || undefined, limit: 50 });
        setBookings(res?.data?.data?.items || []);
        setTotal(res?.data?.data?.total || 0);
      } catch {
        toast.error("Failed to load dining bookings");
      } finally {
        setLoading(false);
      }
    })();
  }, [status]);

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Dining Bookings</h1>
          <p className="text-sm text-gray-500">{total} total reservations</p>
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="seated">Seated</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No show</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : bookings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center text-gray-500">No bookings found.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Restaurant</th>
                <th className="px-4 py-3">Guest</th>
                <th className="px-4 py-3">Date / Slot</th>
                <th className="px-4 py-3">Guests</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bookings.map((b) => (
                <tr key={b._id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{b.restaurant?.name || b.restaurantNameSnapshot}</td>
                  <td className="px-4 py-3 text-gray-600">{b.userNameSnapshot} <span className="text-gray-400">{b.userPhoneSnapshot}</span></td>
                  <td className="px-4 py-3 text-gray-600">{new Date(b.bookingDate).toLocaleDateString()} · {b.slotStart}-{b.slotEnd}</td>
                  <td className="px-4 py-3 text-gray-600">{b.guests}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[b.status] || "bg-gray-100 text-gray-500"}`}>
                      {b.status}
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
