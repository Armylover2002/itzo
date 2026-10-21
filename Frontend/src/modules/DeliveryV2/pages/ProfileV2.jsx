import { useEffect, useRef, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import {
  User,
  ArrowRight,
  Bike,
  Ticket,
  ChevronRight,
  Share2,
  LogOut,
  X,
  Loader2,
  Briefcase,
  Trash2,
  AlertTriangle,
  Truck,
  CreditCard,
  FileText,
  Gift,
  IdCard,
  ScrollText,
  ShieldCheck
} from "lucide-react"
import { deliveryAPI } from "@food/api"
import { toast } from "sonner"
import { clearModuleAuth } from "@food/utils/auth"
import { stopAllSync } from "@/modules/DeliveryV2/services/deliveryOrderSync"
import VehicleSwitcherSheet from '@/modules/DeliveryV2/components/modals/VehicleSwitcherSheet'

/**
 * ProfileV2 - delivery partner account hub (rendered inside DeliveryHomeV2).
 */
export const ProfileV2 = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [referralReward, setReferralReward] = useState(0)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [logoutSubmitting, setLogoutSubmitting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showVehicleSwitcher, setShowVehicleSwitcher] = useState(false)

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true)
        const response = await deliveryAPI.getProfile()
        if (response?.data?.success && response?.data?.data?.profile) {
          setProfile(response.data.data.profile)
        }
      } catch (error) {
        toast.error("Failed to load profile data")
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  useEffect(() => {
    deliveryAPI.getReferralStats().then((res) => {
      const reward = res?.data?.data?.stats?.rewardAmount
      setReferralReward(Number(reward) || 0)
    }).catch(() => {})
  }, [])

  const refId = profile?._id || profile?.id || profile?.referralCode || ""
  const referralLink = refId ? `${window.location.origin}/food/delivery/signup?ref=${encodeURIComponent(String(refId))}` : ""

  const handleShareReferral = async () => {
    if (!referralLink) return
    const rewardText = referralReward > 0 ? `₹${referralReward}` : "rewards"
    const shareText = `Join as a delivery partner and earn ${rewardText}.`
    try {
      if (navigator.share) {
        await navigator.share({ title: "Delivery referral", text: shareText, url: referralLink })
      } else {
        const fallbackUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${referralLink}`)}`
        window.open(fallbackUrl, "_blank", "noopener,noreferrer")
      }
    } catch (e) {}
  }

  const handleLogout = async () => {
    if (logoutSubmitting) return
    setShowLogoutConfirm(false)
    try {
      setLogoutSubmitting(true)
      await deliveryAPI.logout()
    } catch (error) {}
    clearModuleAuth("delivery")
    localStorage.removeItem("app:isOnline")
    stopAllSync()
    toast.success("Logged out successfully")
    navigate("/food/delivery/login", { replace: true })
    setLogoutSubmitting(false)
  }

  const handleDeleteAccount = async () => {
    if (isDeleting) return
    setIsDeleting(true)
    try {
      await deliveryAPI.deleteAccount()
      clearModuleAuth("delivery")
      localStorage.removeItem("app:isOnline")
      stopAllSync()
      toast.success("Account deleted successfully")
      navigate("/food/delivery/login", { replace: true })
    } catch (error) {
      console.error("Error deleting delivery account:", error)
      toast.error(error?.response?.data?.message || "Failed to delete account. Please try again.")
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  // Hex colours on purpose: deliveryTheme.css recolours Tailwind green/blue/orange utilities.
  const menuSections = [
    {
      title: "Account",
      items: [
        { label: "Personal details", hint: "Name, phone & address", icon: User, tone: "bg-[#EEF4FF] text-[#2563EB]", onClick: () => navigate("/food/delivery/profile/details") },
        { label: "Documents", hint: "Aadhaar, PAN & licence", icon: FileText, tone: "bg-[#F5F3FF] text-[#7C3AED]", onClick: () => navigate("/food/delivery/profile/documents") },
        { label: "Bank details", hint: "Account for payouts", icon: CreditCard, tone: "bg-[#ECFDF5] text-[#16A34A]", onClick: () => navigate("/food/delivery/profile/bank") },
        { label: "ID card", hint: "Your delivery partner ID", icon: IdCard, tone: "bg-[#FFF4ED] text-[#F35B1C]", onClick: () => navigate("/food/delivery/help/id-card") },
      ],
    },
    {
      title: "Help & legal",
      items: [
        { label: "Support tickets", hint: "Raise or track an issue", icon: Ticket, tone: "bg-[#FEF3C7] text-[#B45309]", onClick: () => navigate("/food/delivery/help/tickets") },
        { label: "Terms & conditions", icon: ScrollText, tone: "bg-gray-100 text-gray-600", onClick: () => navigate("/food/delivery/profile/terms") },
        { label: "Privacy policy", icon: ShieldCheck, tone: "bg-gray-100 text-gray-600", onClick: () => navigate("/food/delivery/profile/privacy") },
      ],
    },
  ]

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center font-poppins">
        <div className="flex items-center gap-2 text-gray-700">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Loading profile...</span>
        </div>
      </div>
    )
  }

  const phone = profile?.phone ? `${profile?.countryCode || "+91"} ${profile.phone}` : ""

  // No inner scroll container here: DeliveryHomeV2's content area scrolls this page.
  // A nested overflow box with overscroll containment swallowed touch/wheel scrolling.
  return (
    <div className="min-h-full bg-[#F4F5F7] text-gray-900 font-poppins">
      {/* Header */}
      <div className="sticky top-0 z-[100] safe-top bg-white/95 backdrop-blur border-b border-gray-100 px-5 py-4">
        <h1 className="text-[22px] font-extrabold text-gray-900 leading-tight">Profile</h1>
        <p className="text-xs font-medium text-gray-500 mt-0.5">Account &amp; settings</p>
      </div>

      <div className="px-4 pt-4 pb-6 space-y-5">
        {/* Profile card */}
        <button
          onClick={() => navigate("/food/delivery/profile/details")}
          className="relative w-full overflow-hidden rounded-[22px] bg-gradient-to-br from-[#F35B1C] to-[#FF8A4C] p-5 text-left text-white shadow-lg shadow-[#F35B1C]/25 active:scale-[0.99] transition-all"
        >
          <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-4">
            {profile?.profileImage?.url ? (
              <img src={profile.profileImage.url} alt="Profile" className="w-16 h-16 rounded-full object-cover border-2 border-white/70 shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/70 shrink-0">
                <User className="w-8 h-8 text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-extrabold leading-tight truncate">{profile?.name || "Delivery partner"}</h2>
              {profile?.deliveryId && (
                <p className="mt-1 inline-block rounded-md bg-white/20 px-2 py-0.5 text-[11px] font-bold">ID: {profile.deliveryId}</p>
              )}
              {phone && <p className="mt-1 text-xs font-medium text-white/85 truncate">{phone}</p>}
            </div>
            <ChevronRight className="w-5 h-5 text-white/80 shrink-0" />
          </div>
        </button>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate("/food/delivery/history")}
            className="flex items-center gap-3 rounded-[18px] bg-white p-4 border border-gray-100 shadow-sm active:bg-gray-50"
          >
            <div className="w-10 h-10 rounded-xl bg-[#EEF4FF] text-[#2563EB] flex items-center justify-center shrink-0">
              <Bike className="w-5 h-5" />
            </div>
            <span className="text-sm font-bold text-gray-900 text-left">Trip history</span>
          </button>
          <button
            onClick={() => setShowVehicleSwitcher(true)}
            className="flex items-center gap-3 rounded-[18px] bg-white p-4 border border-gray-100 shadow-sm active:bg-gray-50"
          >
            <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] text-[#16A34A] flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <span className="text-sm font-bold text-gray-900 text-left">My vehicles</span>
          </button>
        </div>

        {/* Share & earn */}
        <div className="flex items-center gap-3 rounded-[18px] bg-white p-4 border border-gray-100 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-[#FFF4ED] text-[#F35B1C] flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-900">
              Refer &amp; earn{referralReward > 0 ? ` ₹${referralReward}` : ""}
            </h3>
            <p className="text-xs text-gray-500">Invite friends to join as delivery partners</p>
          </div>
          <button
            onClick={handleShareReferral}
            className="shrink-0 flex items-center gap-1.5 rounded-lg bg-[#F35B1C] px-3 py-2 text-xs font-bold text-white active:scale-95"
          >
            <Share2 className="w-3.5 h-3.5" /> Share
          </button>
        </div>

        {/* Menu sections */}
        {menuSections.map((section) => (
          <section key={section.title}>
            <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-gray-400">{section.title}</h2>
            <div className="rounded-[18px] bg-white border border-gray-100 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {section.items.map(({ label, hint, icon: Icon, tone, onClick }) => (
                <button
                  key={label}
                  onClick={onClick}
                  className="flex w-full items-center gap-3 p-4 text-left active:bg-gray-50"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">{label}</p>
                    {hint && <p className="text-xs text-gray-500">{hint}</p>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </button>
              ))}
            </div>
          </section>
        ))}

        {/* Account actions */}
        <section>
          <div className="rounded-[18px] bg-white border border-gray-100 shadow-sm divide-y divide-gray-100 overflow-hidden">
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex w-full items-center gap-3 p-4 text-left active:bg-[#FEF2F2]"
            >
              <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <span className="flex-1 text-sm font-bold text-[#DC2626]">Log out</span>
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex w-full items-center gap-3 p-4 text-left active:bg-[#FEF2F2]"
            >
              <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#DC2626]">Delete account</p>
                <p className="text-xs text-gray-500">Permanently deactivate your account</p>
              </div>
            </button>
          </div>
        </section>
      </div>

      {/* Logout Confirm Popup */}
      {showLogoutConfirm && (
        <div 
          className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center px-4"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div 
            className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-black text-gray-900 mb-2">Do you want to log out?</h3>
            <p className="text-sm text-gray-500 mb-5">You will be signed out from your delivery account.</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-700 font-bold"
              >
                No
              </button>
              <button
                onClick={handleLogout}
                disabled={logoutSubmitting}
                className="flex-1 h-11 rounded-xl bg-red-600 text-white font-bold disabled:opacity-60"
              >
                {logoutSubmitting ? "Logging out..." : "Yes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirm Popup */}
      {showDeleteConfirm && (
        <div 
          className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center px-4"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div 
            className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3 text-red-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-black text-gray-900">Delete Delivery Account?</h3>
            </div>
            <p className="text-sm text-gray-500 mb-5 leading-relaxed">Are you sure you want to delete your delivery partner account? This will mark your account inactive. Your transaction history remains archived.</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-700 font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="flex-1 h-11 rounded-xl bg-red-600 text-white font-bold disabled:opacity-60"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <VehicleSwitcherSheet 
        isOpen={showVehicleSwitcher}
        onClose={() => setShowVehicleSwitcher(false)}
      />
    </div>
  )
}

export default ProfileV2;
