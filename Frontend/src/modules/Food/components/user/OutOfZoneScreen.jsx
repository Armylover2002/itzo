import { useNavigate, useLocation } from "react-router-dom"
import { useLocationSelector } from "@food/components/user/UserLayout"
import outOfZoneImage from "@/assets/outofzone.png"

/**
 * Full-screen takeover shown whenever the user's current/selected address
 * falls outside every active service zone. Replaces the page content
 * entirely (rather than just graying it out) so there's no way to keep
 * browsing restaurants that can't actually deliver here.
 */
export default function OutOfZoneScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const { openLocationSelector } = useLocationSelector()

  const handleChangeLocation = () => {
    if (openLocationSelector) {
      openLocationSelector()
      return
    }
    // Fallback for the rare case this renders outside UserLayout's provider.
    const currentPath = `${location.pathname || ""}${location.search || ""}${location.hash || ""}` || "/food/user"
    navigate("/cart/address-selector", {
      state: { from: currentPath, backTo: currentPath },
    })
  }

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden bg-white dark:bg-black">
      {/* The artwork already carries the logo + "not operating in this zone"
          message, so it's shown edge-to-edge rather than boxed with repeated text. */}
      <img
        src={outOfZoneImage}
        alt="We're currently not operating in this zone"
        className="absolute inset-0 h-full w-full object-cover object-top"
      />
      <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-white via-white/95 to-transparent px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-14 dark:from-black dark:via-black/95">
        <button
          type="button"
          onClick={handleChangeLocation}
          className="w-full max-w-sm rounded-full bg-[#FB4F01] px-7 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:bg-[#C83C00] active:scale-95"
        >
          Change your location
        </button>
      </div>
    </div>
  )
}
