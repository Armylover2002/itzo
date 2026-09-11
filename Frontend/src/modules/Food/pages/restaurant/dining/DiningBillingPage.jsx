import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Calendar, Loader2, Minus, Phone, Plus, Receipt, Search, Send, Users } from "lucide-react"
import { restaurantAPI } from "@food/api"
import { formatSlotRange } from "@food/utils/dining"
import { toast } from "sonner"

export default function DiningBillingPage() {
  const { id: reservationId } = useParams()
  const navigate = useNavigate()

  const [reservation, setReservation] = useState(null)
  const [menuCategories, setMenuCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [cart, setCart] = useState({}) // foodItemId -> { item, quantity }
  const [discount, setDiscount] = useState(0)
  const [bill, setBill] = useState(null)
  const [saving, setSaving] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const saveTimerRef = useRef(null)
  const isInitialLoad = useRef(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const [reservationsRes, menuRes] = await Promise.all([
          restaurantAPI.getDiningReservations({ limit: 300 }),
          restaurantAPI.getMenu(),
        ])
        if (cancelled) return
        const list = reservationsRes?.data?.data?.reservations || []
        const found = list.find((r) => String(r._id) === String(reservationId))
        setReservation(found || null)
        setMenuCategories(menuRes?.data?.data?.menu?.sections || [])

        if (found?.billId) {
          try {
            const billRes = await restaurantAPI.getDiningBill(found.billId)
            const existingBill = billRes?.data?.data?.bill
            if (existingBill && !cancelled) {
              setBill(existingBill)
              const nextCart = {}
              for (const line of existingBill.items || []) {
                if (line.foodItemId) {
                  nextCart[String(line.foodItemId)] = {
                    item: { id: String(line.foodItemId), name: line.name, price: line.price },
                    quantity: line.quantity,
                  }
                }
              }
              setCart(nextCart)
              setDiscount(existingBill.discount || 0)
            }
          } catch {
            // No draft/finalized bill yet — start fresh.
          }
        }
      } catch (error) {
        toast.error(error?.response?.data?.message || "Failed to load billing data")
      } finally {
        if (!cancelled) {
          setLoading(false)
          isInitialLoad.current = false
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [reservationId])

  const allItems = useMemo(() => {
    const list = []
    for (const cat of menuCategories) {
      for (const item of cat.items || []) {
        if (item.approvalStatus === "approved" && item.isAvailable !== false) {
          list.push({ ...item, categoryName: cat.name })
        }
      }
    }
    return list
  }, [menuCategories])

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return allItems
    return allItems.filter((item) => item.name?.toLowerCase().includes(query))
  }, [allItems, searchQuery])

  const cartLines = useMemo(() => Object.values(cart), [cart])
  const cartTotal = useMemo(() => cartLines.reduce((sum, l) => sum + l.item.price * l.quantity, 0), [cartLines])

  const addItem = (item) => {
    setCart((prev) => {
      const existing = prev[item.id]
      return { ...prev, [item.id]: { item, quantity: (existing?.quantity || 0) + 1 } }
    })
  }

  const changeQuantity = (id, delta) => {
    setCart((prev) => {
      const existing = prev[id]
      if (!existing) return prev
      const nextQty = existing.quantity + delta
      if (nextQty <= 0) {
        const next = { ...prev }
        delete next[id]
        return next
      }
      return { ...prev, [id]: { ...existing, quantity: nextQty } }
    })
  }

  // Debounced auto-save of the draft bill whenever the cart changes.
  useEffect(() => {
    if (isInitialLoad.current) return
    if (cartLines.length === 0) return
    if (bill?.status && bill.status !== "draft") return

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      try {
        setSaving(true)
        const items = cartLines.map((l) => ({ foodItemId: l.item.id, quantity: l.quantity }))
        const response = await restaurantAPI.saveDiningBill(reservationId, { items, discount })
        if (response?.data?.success) setBill(response.data.data.bill)
      } catch (error) {
        toast.error(error?.response?.data?.message || "Failed to save bill")
      } finally {
        setSaving(false)
      }
    }, 600)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartLines, discount])

  const handleFinalize = async () => {
    if (!bill?._id) {
      toast.error("Add at least one item before sending the bill")
      return
    }
    if (!window.confirm("Send this bill to the guest? No further edits will be allowed.")) return
    try {
      setFinalizing(true)
      const response = await restaurantAPI.finalizeDiningBill(bill._id)
      if (response?.data?.success) {
        toast.success("Bill sent to guest")
        setBill(response.data.data.bill)
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to finalize bill")
    } finally {
      setFinalizing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0f2d5a]" />
      </div>
    )
  }

  if (!reservation) {
    return (
      <div className="p-6 text-center text-slate-600">
        Booking not found.
        <button onClick={() => navigate(-1)} className="mt-3 block text-sm text-[#0f2d5a] underline">Go back</button>
      </div>
    )
  }

  const isLocked = bill?.status && bill.status !== "draft"

  const header = (
    <div className="mb-5 flex items-start gap-3">
      <button onClick={() => navigate(-1)} className="shrink-0 rounded-lg p-2 hover:bg-slate-200 active:bg-slate-300">
        <ArrowLeft className="h-5 w-5 text-slate-700" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">Bill — {reservation.userNameSnapshot || "Guest"}</h1>
          {isLocked && (
            <span className="inline-flex shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 capitalize">
              {bill.status}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 sm:text-sm">
          {reservation.bookingDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              {new Date(reservation.bookingDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {formatSlotRange(reservation.slotStart, reservation.slotEnd)}
            </span>
          )}
          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5 shrink-0" /> {reservation.guests} guests</span>
          {reservation.userPhoneSnapshot && (
            <a href={`tel:${reservation.userPhoneSnapshot}`} className="flex items-center gap-1 text-[#0f2d5a] hover:underline">
              <Phone className="h-3.5 w-3.5 shrink-0" /> {reservation.userPhoneSnapshot}
            </a>
          )}
        </div>
        {reservation.specialRequest && (
          <p className="mt-1 text-xs italic text-slate-400">"{reservation.specialRequest}"</p>
        )}
      </div>
    </div>
  )

  const billItems = (
    cartLines.length === 0 ? (
      <p className="py-8 text-center text-sm text-slate-400">Tap menu items to add them to the bill</p>
    ) : (
      <div className="space-y-3">
        {cartLines.map(({ item, quantity }) => (
          <div key={item.id} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">{item.name}</p>
              <p className="text-xs text-slate-400">₹{item.price} each</p>
            </div>
            {!isLocked ? (
              <div className="flex shrink-0 items-center gap-2">
                <button onClick={() => changeQuantity(item.id, -1)} className="rounded-md border border-slate-300 p-1 text-slate-600 hover:bg-slate-100">
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-5 text-center text-sm font-semibold">{quantity}</span>
                <button onClick={() => changeQuantity(item.id, 1)} className="rounded-md border border-slate-300 p-1 text-slate-600 hover:bg-slate-100">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <span className="shrink-0 text-sm font-medium text-slate-600">x{quantity}</span>
            )}
          </div>
        ))
        }
      </div>
    )
  )

  const totals = (
    <div className="mt-4 space-y-1.5 border-t border-dashed border-slate-200 pt-4 text-sm">
      <div className="flex justify-between text-slate-600">
        <span>Subtotal</span>
        <span>₹{(bill?.subtotal ?? cartTotal).toLocaleString("en-IN")}</span>
      </div>
      {!isLocked ? (
        <div className="flex items-center justify-between text-slate-600">
          <span>Discount</span>
          <input
            type="number"
            min="0"
            value={discount}
            onChange={(event) => setDiscount(Number(event.target.value) || 0)}
            className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm outline-none focus:border-slate-900"
          />
        </div>
      ) : bill?.discount > 0 && (
        <div className="flex justify-between text-slate-600">
          <span>Discount</span>
          <span>-₹{Number(bill.discount).toLocaleString("en-IN")}</span>
        </div>
      )}
      {bill?.taxAmount > 0 && (
        <div className="flex justify-between text-slate-600">
          <span>Tax ({bill.taxPercent}%)</span>
          <span>₹{bill.taxAmount.toLocaleString("en-IN")}</span>
        </div>
      )}
      <div className="flex justify-between border-t border-dashed border-slate-200 pt-2.5 text-base font-bold text-slate-900">
        <span>Grand Total</span>
        <span>₹{(bill?.grandTotal ?? cartTotal - discount).toLocaleString("en-IN")}</span>
      </div>
      {bill?.restaurantPayout != null && (
        <p className="pt-1 text-xs text-slate-400">You'll receive ₹{bill.restaurantPayout.toLocaleString("en-IN")} after platform commission.</p>
      )}
    </div>
  )

  // Finalized/settled bills get a focused, single-column receipt instead of
  // the editor layout — the menu picker has nothing to do once it's locked.
  if (isLocked) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-md">
          {header}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Bill</h2>
            </div>
            {billItems}
            {totals}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 pb-24 sm:px-6 lg:pb-6">
      {header}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search menu items"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-slate-900"
              />
            </div>
            <div className="mt-4 grid max-h-[50vh] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 lg:max-h-[calc(100vh-260px)]">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => addItem(item)}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-[#0f2d5a] hover:bg-slate-50 active:bg-slate-100"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-400">{item.categoryName}</p>
                  </div>
                  <span className="ml-3 shrink-0 text-sm font-semibold text-slate-700">₹{item.price}</span>
                </button>
              ))}
              {filteredItems.length === 0 && (
                <p className="col-span-1 py-8 text-center text-sm text-slate-400 sm:col-span-2">No menu items found</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6 lg:self-start">
          <div className="mb-3 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Bill</h2>
            {saving && <Loader2 className="ml-auto h-4 w-4 animate-spin text-slate-400" />}
          </div>

          {billItems}
          {totals}

          <button
            onClick={handleFinalize}
            disabled={finalizing || !bill?._id}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0f2d5a] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {finalizing ? "Sending..." : "Send Bill to Guest"}
          </button>
        </div>
      </div>
    </div>
  )
}
