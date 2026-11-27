import { useCallback, useEffect, useState } from "react"
import { Store, LogOut, Loader2 } from "lucide-react"
import { getStashedHubSession, exitOutletSession } from "@food/utils/auth"

/**
 * Shown on every restaurant screen while the main restaurant is operating one
 * of its franchise outlets (Hub & franchise outlets -> Open). Makes it obvious
 * whose menu/orders/money is on screen, and gives the one-click way back.
 *
 * Nothing renders for a normal restaurant login or for a real franchise login —
 * both have no stashed hub session.
 */
export default function OutletSessionBanner() {
  const [hubSession, setHubSession] = useState(() => getStashedHubSession())
  const [leaving, setLeaving] = useState(false)

  // The stash is written by another page (HubOutlets) right before it reloads,
  // and cleared on logout — re-read on focus/storage so the banner never lingers.
  useEffect(() => {
    const sync = () => setHubSession(getStashedHubSession())
    window.addEventListener("storage", sync)
    window.addEventListener("focus", sync)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("focus", sync)
    }
  }, [])

  const handleExit = useCallback(() => {
    setLeaving(true)
    if (!exitOutletSession()) {
      setLeaving(false)
      setHubSession(null)
      return
    }
    // Full reload so every page/context re-reads the restored hub session.
    window.location.assign("/food/restaurant/hub-outlets")
  }, [])

  if (!hubSession) return null

  return (
    <div className="sticky top-0 z-40 bg-[#10335D] text-white px-4 py-2 flex items-center gap-3">
      <Store size={16} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold truncate">
          Viewing outlet: {hubSession.outletName || "Franchise outlet"}
        </p>
        <p className="text-[11px] text-white/70 truncate">
          Signed in as {hubSession.hubName || "main restaurant"} — changes apply to this outlet only
        </p>
      </div>
      <button
        onClick={handleExit}
        disabled={leaving}
        className="shrink-0 flex items-center gap-1 bg-white/15 hover:bg-white/25 disabled:opacity-60 rounded-full px-3 py-1.5 text-[11px] font-bold"
      >
        {leaving ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
        Back to main
      </button>
    </div>
  )
}
