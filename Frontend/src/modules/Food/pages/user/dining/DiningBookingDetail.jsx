import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, Calendar, Users, MapPin, XCircle, IndianRupee } from "lucide-react";
import { toast } from "sonner";
import AnimatedPage from "@food/components/user/AnimatedPage";
import PageNavbar from "@food/components/user/PageNavbar";
import { diningAPI } from "@food/api";
import { getCurrentUser } from "@food/utils/auth";
import { initRazorpayPayment } from "@food/utils/razorpay";
import { getCompanyName } from "@common/utils/businessSettings";

const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  seated: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
  no_show: "bg-red-100 text-red-700",
};

export default function DiningBookingDetail() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [reservation, setReservation] = useState(null);
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [paying, setPaying] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await diningAPI.getMyReservationDetail(bookingId);
      const r = res?.data?.data?.reservation;
      setReservation(r);
      if (r?.billId) {
        const billRes = await diningAPI.getBill(r.billId);
        setBill(billRes?.data?.data?.bill || null);
      }
    } catch {
      toast.error("Failed to load booking");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [bookingId]);

  const handleCancel = async () => {
    if (!window.confirm("Cancel this reservation?")) return;
    try {
      setCancelling(true);
      await diningAPI.cancelReservation(bookingId, "Cancelled by user");
      toast.success("Reservation cancelled");
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to cancel reservation");
    } finally {
      setCancelling(false);
    }
  };

  const handlePay = async () => {
    if (!bill?._id) return;
    try {
      setPaying(true);
      const orderRes = await diningAPI.createBillPaymentOrder(bill._id);
      const order = orderRes?.data?.data;
      const user = getCurrentUser("user");

      await initRazorpayPayment({
        key: order.key,
        amount: order.amount,
        currency: order.currency || "INR",
        order_id: order.orderId,
        name: getCompanyName() || "Appzeto Food",
        description: `Dining bill payment`,
        prefill: { name: user?.name || "", email: user?.email || "", contact: user?.phone || "" },
        handler: async (response) => {
          try {
            await diningAPI.verifyBillPayment(bill._id, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success("Payment successful!");
            fetchData();
          } catch {
            toast.error("Payment verification failed");
          } finally {
            setPaying(false);
          }
        },
        onError: (err) => {
          toast.error(err?.description || "Payment failed");
          setPaying(false);
        },
        onClose: () => setPaying(false),
      });
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to start payment");
      setPaying(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  if (!reservation) return <div className="p-6 text-center text-gray-500">Booking not found.</div>;

  const canCancel = ["pending", "confirmed"].includes(reservation.status);

  return (
    <AnimatedPage>
      <div className="min-h-screen bg-white dark:bg-[#0a0a0a]">
        <div className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur-sm dark:border-gray-800 dark:bg-[#0a0a0a]/95">
          <PageNavbar textColor="black" zIndex={20} showProfile={false} showLogo={false} />
        </div>

        <div className="mx-auto max-w-xl space-y-5 px-4 pb-10 pt-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-[#1a1a1a]">
            <div className="mb-3 flex items-center justify-between">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">{reservation.restaurant?.name || reservation.restaurantNameSnapshot}</h1>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[reservation.status] || "bg-gray-100 text-gray-500"}`}>{reservation.status}</span>
            </div>
            <div className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
              <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /> {new Date(reservation.bookingDate).toLocaleDateString()} · {reservation.slotStart}-{reservation.slotEnd}</div>
              <div className="flex items-center gap-2"><Users className="h-4 w-4" /> {reservation.guests} guests</div>
              {reservation.restaurant?.phone && <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {reservation.restaurant.phone}</div>}
            </div>
            {reservation.specialRequest && (
              <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs italic text-gray-500 dark:bg-gray-900">"{reservation.specialRequest}"</p>
            )}

            {canCancel && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 py-2.5 text-sm font-semibold text-red-600 disabled:opacity-60"
              >
                <XCircle className="h-4 w-4" /> Cancel Reservation
              </button>
            )}
          </div>

          {bill && (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-[#1a1a1a]">
              <h2 className="mb-3 text-base font-bold text-gray-900 dark:text-white">Bill</h2>
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                {bill.items?.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{item.name} × {item.quantity}</span>
                    <span>₹{item.total}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-gray-100 pt-2"><span>Subtotal</span><span>₹{bill.subtotal}</span></div>
                <div className="flex justify-between"><span>Tax</span><span>₹{bill.taxAmount}</span></div>
                {bill.discount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-₹{bill.discount}</span></div>}
                <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-bold text-gray-900 dark:text-white"><span>Total</span><span>₹{bill.grandTotal}</span></div>
              </div>

              {bill.status === "finalized" && (
                <button
                  onClick={handlePay}
                  disabled={paying}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#FF0000] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  <IndianRupee className="h-4 w-4" /> {paying ? "Processing..." : `Pay ₹${bill.grandTotal}`}
                </button>
              )}
              {["paid", "settled"].includes(bill.status) && (
                <div className="mt-4 rounded-lg bg-green-50 py-2.5 text-center text-sm font-semibold text-green-700">Paid</div>
              )}
            </div>
          )}
        </div>
      </div>
    </AnimatedPage>
  );
}
