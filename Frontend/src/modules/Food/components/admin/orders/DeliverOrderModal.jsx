import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@food/components/ui/dialog"
import { Button } from "@food/components/ui/button"

export default function DeliverOrderModal({ isOpen, onOpenChange, order, onConfirm, isProcessing }) {
  const [note, setNote] = useState("")

  useEffect(() => {
    if (isOpen) setNote("")
  }, [isOpen])

  if (!order) return null

  const isCash = String(order.paymentType || "").toLowerCase().includes("cash")

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-white p-6 rounded-2xl">
        <DialogHeader>
          <DialogTitle>Mark order as delivered</DialogTitle>
          <DialogDescription className="mt-2 text-slate-500">
            Order <span className="font-semibold text-slate-700">{order.orderId}</span> will be completed on the
            rider&apos;s behalf. {isCash ? "The cash payment will be recorded as collected. " : ""}
            Customer, restaurant and rider will be notified, and earnings and settlement will be updated. This
            cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            onConfirm(note.trim())
          }}
          className="space-y-6 pt-2"
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              placeholder="e.g. Customer confirmed delivery on call"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={isProcessing}
            >
              {isProcessing ? "Updating..." : "Mark Delivered"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
