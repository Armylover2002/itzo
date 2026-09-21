import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, Plus, Trash2, Save, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { restaurantAPI } from "@food/api";

export default function DiningBillingPage() {
  const { id: reservationId } = useParams();
  const navigate = useNavigate();
  const [reservation, setReservation] = useState(null);
  const [bill, setBill] = useState(null);
  const [items, setItems] = useState([{ name: "", price: 0, quantity: 1 }]);
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await restaurantAPI.getDiningReservations({});
      const list = res?.data?.data?.reservations || [];
      const found = list.find((r) => r._id === reservationId);
      setReservation(found || null);

      if (found?.billId) {
        const billRes = await restaurantAPI.getDiningBill(found.billId);
        const b = billRes?.data?.data?.bill;
        setBill(b);
        if (b?.items?.length) setItems(b.items.map((i) => ({ name: i.name, price: i.price, quantity: i.quantity })));
        setDiscount(b?.discount || 0);
      }
    } catch {
      toast.error("Failed to load bill");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [reservationId]);

  const updateItem = (idx, field, value) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const addItem = () => setItems((prev) => [...prev, { name: "", price: 0, quantity: 1 }]);
  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const subtotal = items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);

  const handleSaveBill = async () => {
    const validItems = items.filter((it) => it.name.trim() && Number(it.price) > 0 && Number(it.quantity) > 0);
    if (!validItems.length) {
      toast.error("Add at least one valid item");
      return;
    }
    try {
      setSaving(true);
      const res = await restaurantAPI.saveDiningBill(reservationId, {
        items: validItems.map((it) => ({ name: it.name, price: Number(it.price), quantity: Number(it.quantity) })),
        discount: Number(discount) || 0,
      });
      setBill(res?.data?.data?.bill);
      toast.success("Bill saved");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save bill");
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!bill?._id) {
      toast.error("Save the bill first");
      return;
    }
    if (!window.confirm("Finalize this bill? The guest will be notified to pay.")) return;
    try {
      setFinalizing(true);
      const res = await restaurantAPI.finalizeDiningBill(bill._id);
      setBill(res?.data?.data?.bill);
      toast.success("Bill finalized — guest can now pay");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to finalize bill");
    } finally {
      setFinalizing(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  if (!reservation) return <div className="p-6 text-center text-gray-500">Reservation not found.</div>;

  const isLocked = bill && bill.status !== "draft";

  return (
    <div className="mx-auto max-w-xl p-4 sm:p-6">
      <button onClick={() => navigate(-1)} className="mb-4 text-sm text-gray-500">← Back to bookings</button>
      <h1 className="mb-1 text-xl font-bold text-gray-900 sm:text-2xl">Billing</h1>
      <p className="mb-5 text-sm text-gray-500">{reservation.userNameSnapshot} · {reservation.guests} guests</p>

      {bill && (
        <div className="mb-4 rounded-lg bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600">
          Bill status: <span className="uppercase">{bill.status}</span>
        </div>
      )}

      <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              value={item.name}
              disabled={isLocked}
              onChange={(e) => updateItem(idx, "name", e.target.value)}
              placeholder="Item name"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
            />
            <input
              type="number"
              value={item.price}
              disabled={isLocked}
              onChange={(e) => updateItem(idx, "price", e.target.value)}
              placeholder="Price"
              className="w-20 rounded-lg border border-gray-300 px-2 py-2 text-sm disabled:bg-gray-50"
            />
            <input
              type="number"
              value={item.quantity}
              disabled={isLocked}
              onChange={(e) => updateItem(idx, "quantity", e.target.value)}
              placeholder="Qty"
              className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-sm disabled:bg-gray-50"
            />
            {!isLocked && (
              <button onClick={() => removeItem(idx)} className="text-red-500"><Trash2 className="h-4 w-4" /></button>
            )}
          </div>
        ))}

        {!isLocked && (
          <button onClick={addItem} className="flex items-center gap-1 text-sm font-medium text-[#0D315B]">
            <Plus className="h-4 w-4" /> Add item
          </button>
        )}

        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
          <label className="text-sm text-gray-600">Discount (₹)</label>
          <input
            type="number"
            value={discount}
            disabled={isLocked}
            onChange={(e) => setDiscount(e.target.value)}
            className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-50"
          />
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-sm font-semibold text-gray-900">
          <span>Subtotal</span>
          <span>₹{subtotal.toFixed(2)}</span>
        </div>

        {bill && (
          <div className="space-y-1 border-t border-gray-100 pt-3 text-sm text-gray-600">
            <div className="flex justify-between"><span>Tax</span><span>₹{bill.taxAmount}</span></div>
            <div className="flex justify-between font-bold text-gray-900"><span>Grand total</span><span>₹{bill.grandTotal}</span></div>
          </div>
        )}

        {!isLocked && (
          <div className="flex gap-2 pt-2">
            <button onClick={handleSaveBill} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Bill
            </button>
            <button onClick={handleFinalize} disabled={finalizing || !bill} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0D315B] py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Finalize
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
