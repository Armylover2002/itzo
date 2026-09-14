import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@food/components/ui/dialog"
import { Button } from "@food/components/ui/button"

export default function RejectOrderModal({ isOpen, onOpenChange, order, onConfirm, isProcessing }) {
  const [reason, setReason] = useState("Order rejected by admin")
  const [error, setError] = useState("")

  useEffect(() => {
    if (isOpen) {
      setReason("Order rejected by admin")
      setError("")
    }
  }, [isOpen])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!reason.trim()) {
      setError("Please enter a rejection reason")
      return
    }
    onConfirm(reason.trim())
  }

  if (!order) return null

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-white p-6 rounded-2xl">
        <DialogHeader>
          <DialogTitle>Reject Order</DialogTitle>
          <DialogDescription className="mt-2 text-slate-500">
            Are you sure you want to reject order <span className="font-semibold text-slate-700">{order.orderId}</span>? Please provide a reason.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Rejection Reason</label>
              <textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value)
                  setError("")
                }}
                rows={3}
                className={`w-full px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 ${
                  error ? "border-rose-500 bg-rose-50" : "border-slate-200"
                }`}
                placeholder="Enter rejection reason..."
              />
              {error && <p className="text-xs text-rose-500">{error}</p>}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-rose-600 hover:bg-rose-700 text-white"
              disabled={isProcessing}
            >
              {isProcessing ? "Rejecting..." : "Reject Order"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
