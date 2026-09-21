import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Star, MapPin, IndianRupee, Loader2, Users, Calendar } from "lucide-react";
import { toast } from "sonner";
import AnimatedPage from "@food/components/user/AnimatedPage";
import PageNavbar from "@food/components/user/PageNavbar";
import OptimizedImage from "@food/components/OptimizedImage";
import { diningAPI } from "@food/api";
import { isModuleAuthenticated } from "@food/utils/auth";

function todayDateString() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function DiningRestaurantDetail() {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayDateString());
  const [guests, setGuests] = useState(2);
  const [availability, setAvailability] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [specialRequest, setSpecialRequest] = useState("");
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await diningAPI.getRestaurantDetail(restaurantId);
        setRestaurant(res?.data?.data || null);
      } catch (err) {
        toast.error(err?.response?.data?.message || "Restaurant not found");
      } finally {
        setLoading(false);
      }
    })();
  }, [restaurantId]);

  useEffect(() => {
    if (!date) return;
    (async () => {
      try {
        setLoadingSlots(true);
        setSelectedSlot(null);
        const res = await diningAPI.getAvailability(restaurantId, date);
        setAvailability(res?.data?.data || null);
      } catch {
        setAvailability(null);
      } finally {
        setLoadingSlots(false);
      }
    })();
  }, [restaurantId, date]);

  const handleBook = async () => {
    if (!isModuleAuthenticated("user")) {
      toast.error("Please login to book a table");
      navigate("/user/auth/login");
      return;
    }
    if (!selectedSlot) {
      toast.error("Select a time slot");
      return;
    }
    try {
      setBooking(true);
      const res = await diningAPI.createReservation({
        restaurantId, bookingDate: date, slotStart: selectedSlot.start, guests: Number(guests), specialRequest,
      });
      toast.success("Table reserved!");
      navigate(`/food/user/dining/bookings/${res?.data?.data?.reservation?._id}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to create reservation");
    } finally {
      setBooking(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  if (!restaurant) return <div className="p-6 text-center text-gray-500">Restaurant not found.</div>;

  return (
    <AnimatedPage>
      <div className="min-h-screen bg-white dark:bg-[#0a0a0a]">
        <div className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur-sm dark:border-gray-800 dark:bg-[#0a0a0a]/95">
          <PageNavbar textColor="black" zIndex={20} showProfile={false} showLogo={false} />
        </div>

        <div className="relative h-52 w-full overflow-hidden sm:h-72">
          <OptimizedImage src={restaurant.image} alt={restaurant.name} className="h-full w-full" objectFit="cover" priority />
        </div>

        <div className="mx-auto max-w-3xl space-y-5 px-4 pb-10 pt-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">{restaurant.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              {Number(restaurant.rating) > 0 && (
                <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-green-600 text-green-600" /> {Number(restaurant.rating).toFixed(1)}</span>
              )}
              <span className="flex items-center gap-1"><IndianRupee className="h-3.5 w-3.5" /> {restaurant.avgCostForTwo || "—"} for two</span>
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {restaurant.location?.area || restaurant.location?.city || ""}</span>
            </div>
            {restaurant.description && <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{restaurant.description}</p>}
          </div>

          {restaurant.ambienceImages?.length > 0 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {restaurant.ambienceImages.map((img, i) => (
                <img key={i} src={img} alt="" className="h-24 w-32 shrink-0 rounded-xl object-cover" />
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-[#1a1a1a]">
            <h2 className="mb-3 text-base font-bold text-gray-900 dark:text-white">Book a table</h2>

            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400"><Calendar className="h-3.5 w-3.5" /> Date</label>
                <input type="date" value={date} min={todayDateString()} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-[#0a0a0a] dark:text-white" />
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400"><Users className="h-3.5 w-3.5" /> Guests</label>
                <input type="number" min={1} value={guests} onChange={(e) => setGuests(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-[#0a0a0a] dark:text-white" />
              </div>
            </div>

            {loadingSlots ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
            ) : !availability?.slots?.length ? (
              <div className="py-6 text-center text-sm text-gray-500">No slots available on this date.</div>
            ) : (
              <div className="mb-4 flex flex-wrap gap-2">
                {availability.slots.map((slot) => {
                  const full = slot.available <= 0 || slot.available < Number(guests);
                  return (
                    <button
                      key={slot.start}
                      disabled={full}
                      onClick={() => setSelectedSlot(slot)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                        full
                          ? "cursor-not-allowed border-gray-100 text-gray-300"
                          : selectedSlot?.start === slot.start
                          ? "border-[#FE5502] bg-red-50 text-[#FE5502]"
                          : "border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {slot.start}
                    </button>
                  );
                })}
              </div>
            )}

            <textarea
              value={specialRequest}
              onChange={(e) => setSpecialRequest(e.target.value)}
              rows={2}
              placeholder="Any special request (optional)"
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-[#0a0a0a] dark:text-white"
            />

            <button
              onClick={handleBook}
              disabled={booking || !selectedSlot}
              className="w-full rounded-lg bg-[#FE5502] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {booking ? "Booking..." : "Reserve Table"}
            </button>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
