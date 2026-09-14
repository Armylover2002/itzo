import { AlertTriangle, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@food/components/ui/dialog"

export default function DeleteCampaignDialog({ isOpen, onOpenChange, campaign, onConfirm }) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Delete Campaign
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the campaign.
          </DialogDescription>
        </DialogHeader>
        
        {campaign && (
          <div className="px-6 py-6 space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">
                Are you sure you want to delete <span className="font-semibold">"{campaign.title}"</span>?
              </p>
            </div>
            
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onConfirm(campaign.sl)
                  onOpenChange(false)
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-all shadow-md"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

