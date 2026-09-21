import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { restaurantAPI } from "@food/api";

const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  seated: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
  no_show: "bg-red-100 text-red-700",
};

const NEXT_ACTIONS = {
  pending: [{ label: "Confirm", status: "confirmed" }, { label: "Decline", status: "cancelled" }],
  confirmed: [{ label: "Seat guest", status: "seated" }, { label: "No show", status: "no_show" }, { label: "Cancel", status: "cancelled" }],
  seated: [{ label: "Complete", status: "completed" }],
};

export default function DiningBookingsPage() {
  const navigate = useNavigate();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState(null);

  const fetchReservations = async () => {
    try {
      setLoading(true);
      const res = await restaurantAPI.getDiningReservations({ status: status || undefined });
      setReservations(res?.data?.data?.reservations || []);
    } catch {
      toast.error("Failed to load reservations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReservations(); }, [status]);

  const handleAction = async (id, newStatus) => {
    try {
      setBusyId(id);
      await restaurantAPI.updateDiningReservationStatus(id, { status: newStatus });
      toast.success("Reservation updated");
      fetchReservations();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update reservation");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Dining Bookings</h1>
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
      ) : reservations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center text-gray-500">No reservations found.</div>
      ) : (
        <div className="space-y-3">
          {reservations.map((r) => (
            <div key={r._id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{r.userNameSnapshot} · {r.guests} guests</p>
                  <p className="text-xs text-gray-500">{r.userPhoneSnapshot}</p>
                  <p className="text-xs text-gray-500">{new Date(r.bookingDate).toLocaleDateString()} · {r.slotStart}-{r.slotEnd}</p>
                  {r.specialRequest && <p className="mt-1 text-xs italic text-gray-400">"{r.specialRequest}"</p>}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[r.status] || "bg-gray-100 text-gray-500"}`}>{r.status}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(NEXT_ACTIONS[r.status] || []).map((action) => (
                  <button
                    key={action.status}
                    onClick={() => handleAction(r._id, action.status)}
                    disabled={busyId === r._id}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {action.label}
                  </button>
                ))}
                {(r.status === "seated" || r.status === "completed") && (
                  <button
                    onClick={() => navigate(`/food/restaurant/dining/bookings/${r._id}/bill`)}
                    className="flex items-center gap-1 rounded-lg bg-[#0D315B] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    <Receipt className="h-3.5 w-3.5" /> {r.billId ? "View Bill" : "Create Bill"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
