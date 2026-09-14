import { Eye, MapPin } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@food/components/ui/dialog"

export default function ViewZoneDialog({ isOpen, onOpenChange, zone }) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-600" />
            Zone Details
          </DialogTitle>
          <DialogDescription>
            View complete information about this zone
          </DialogDescription>
        </DialogHeader>
        {zone && (
          <div className="px-6 py-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Zone ID</p>
                <p className="text-sm font-medium text-slate-900">{zone.zoneId}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</p>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                  zone.status ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                }`}>
                  {zone.status ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="space-y-1 col-span-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Zone Name</p>
                <p className="text-sm font-medium text-slate-900">{zone.name}</p>
              </div>
              <div className="space-y-1 col-span-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Display Name</p>
                <p className="text-sm font-medium text-slate-900">{zone.displayName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Restaurants</p>
                <p className="text-sm font-medium text-slate-900">{zone.restaurants}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Deliverymen</p>
                <p className="text-sm font-medium text-slate-900">{zone.deliverymen}</p>
              </div>
              <div className="space-y-1 col-span-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Default Status</p>
                {zone.isDefault ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    Default Zone
                  </span>
                ) : (
                  <span className="text-sm text-slate-600">Not set as default</span>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

