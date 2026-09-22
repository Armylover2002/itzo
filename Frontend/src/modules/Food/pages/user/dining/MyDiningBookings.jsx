import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Calendar, Users } from "lucide-react";
import { toast } from "sonner";
import AnimatedPage from "@food/components/user/AnimatedPage";
import PageNavbar from "@food/components/user/PageNavbar";
import { diningAPI } from "@food/api";
import { formatTimeAMPM } from "@shared/utils/timeFormat";

const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  seated: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
  no_show: "bg-red-100 text-red-700",
};

export default function MyDiningBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await diningAPI.getMyReservations();
        setBookings(res?.data?.data?.reservations || []);
      } catch {
        toast.error("Failed to load your bookings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AnimatedPage>
      <div className="min-h-screen bg-white dark:bg-[#0a0a0a]">
        <div className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur-sm dark:border-gray-800 dark:bg-[#0a0a0a]/95">
          <PageNavbar textColor="black" zIndex={20} showProfile={false} showLogo={false} />
        </div>

        <div className="mx-auto max-w-2xl space-y-3 px-4 pb-10 pt-4">
          <h1 className="mb-2 text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">My Dining Bookings</h1>

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : bookings.length === 0 ? (
            <div className="py-16 text-center text-gray-500 dark:text-gray-400">You haven't booked a table yet.</div>
          ) : (
            bookings.map((b) => (
              <Link
                key={b._id}
                to={`/food/user/dining/bookings/${b._id}`}
                className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-[#1a1a1a]"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold text-gray-900 dark:text-white">{b.restaurant?.name || b.restaurantNameSnapshot}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[b.status] || "bg-gray-100 text-gray-500"}`}>{b.status}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {new Date(b.bookingDate).toLocaleDateString()} · {formatTimeAMPM(b.slotStart)}</span>
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {b.guests}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </AnimatedPage>
  );
}
