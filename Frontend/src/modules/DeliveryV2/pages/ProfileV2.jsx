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
  AlertTriangle
} from "lucide-react"
import { deliveryAPI } from "@food/api"
import { toast } from "sonner"
import { clearModuleAuth } from "@food/utils/auth"
import { useSubscriptionRequired } from "@common/hooks/useSubscriptionRequired"

/**
 * ProfileV2 - 1:1 EXACT Restoration of the Legacy Profile Hub.
 * Matches ProfilePage.jsx exactly.
 */
export const ProfileV2 = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const subscriptionRequired = useSubscriptionRequired("DELIVERY_PARTNER")
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [referralReward, setReferralReward] = useState(0)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [logoutSubmitting, setLogoutSubmitting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

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
    toast.success("Logged out successfully")
    navigate("/food/delivery/login", { replace: true })
    setLogoutSubmitting(false)
  }

  const handleDeleteAccount = async () => {
    if (deleteSubmitting) return
    setShowDeleteConfirm(false)
    try {
      setDeleteSubmitting(true)
      await deliveryAPI.deleteAccount()
      toast.success("Account deleted successfully")
      clearModuleAuth("delivery")
      localStorage.removeItem("app:isOnline")
      navigate("/food/delivery/login", { replace: true })
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete account")
    } finally {
      setDeleteSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center font-poppins">
        <div className="flex items-center gap-2 text-gray-700">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Loading profile...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 font-poppins pb-24">
      {/* 0. Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-[100] safe-top">
         <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-primary border border-orange-100">
               <User className="w-5 h-5" />
            </div>
            <div>
               <h1 className="text-xl font-black text-gray-950 uppercase tracking-tighter">My Profile</h1>
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Account & Settings</p>
            </div>
         </div>
      </div>
      {/* Profile Header Block */}
      <div className="bg-white p-4 w-full shadow-sm">
        <div 
          onClick={() => navigate("/food/delivery/profile/details")}
          className="flex items-start justify-between cursor-pointer"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-2xl md:text-3xl font-bold">{profile?.name || ""}</h2>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-gray-600 text-sm md:text-base mb-3 font-medium">{profile?.deliveryId || ""}</p>
          </div>
          <div className="relative shrink-0 ml-4">
            {profile?.profileImage?.url ? (
              <img src={profile.profileImage.url} alt="Profile" className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-2 border-gray-200" />
            ) : (
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-200">
                <User className="w-10 h-10 md:w-12 md:h-12 text-gray-400" />
              </div>
            )}
            <div className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-md border-2 border-white">
              <Briefcase className="w-4 h-4 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-6">
        {/* Navigation Buttons */}
        <div className="grid grid-cols-1 gap-3 mb-6">
          <button
            onClick={() => navigate("/food/delivery/history")}
            className="bg-white rounded-xl p-4 flex flex-col items-center gap-2 border border-transparent active:bg-gray-50 transition-colors"
          >
            <div className="rounded-full bg-gray-50 p-3">
              <Bike className="w-6 h-6 text-gray-700" />
            </div>
            <span className="text-sm font-bold text-gray-900">Trips history</span>
          </button>
          
          {subscriptionRequired && (
            <button
              onClick={() => navigate("/food/delivery/subscription")}
              className="bg-white rounded-xl p-4 flex flex-col items-center gap-2 border border-transparent active:bg-gray-50 transition-colors"
            >
              <div className="rounded-full bg-orange-50 p-3">
                <Briefcase className="w-6 h-6 text-orange-600" />
              </div>
              <span className="text-sm font-bold text-gray-900">Partner Subscription</span>
            </button>
          )}
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {/* Share & Earn */}
          <div className="bg-white rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900 mb-1">
                Share & Earn{referralReward > 0 ? ` ₹${referralReward}` : ""}
              </h3>
              <p className="text-gray-500 text-xs font-medium">Invite friends to join the delivery partner fleet.</p>
            </div>
            <button
              onClick={handleShareReferral}
              className="shrink-0 bg-black text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest shadow-md"
            >
              Share
            </button>
          </div>

          {/* Support Section */}
          <div>
            <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] mb-3 px-1">Support</h3>
            <div 
              onClick={() => navigate("/food/delivery/help/tickets")}
              className="bg-white rounded-xl p-4 flex items-center justify-between cursor-pointer active:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Ticket className="w-5 h-5 text-gray-700" />
                <span className="text-sm font-bold text-gray-900">Support tickets</span>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-300" />
            </div>
          </div>

          {/* Partner options Section */}
          {/* Logout Section */}
          <div className="pt-4 space-y-3">
            <div 
              onClick={() => setShowLogoutConfirm(true)}
              className="bg-white rounded-xl p-4 flex items-center justify-between cursor-pointer border border-red-50 hover:bg-red-50/30 active:bg-red-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5 text-red-600" />
                <span className="text-sm font-bold text-red-600">Log out</span>
              </div>
              <ArrowRight className="w-5 h-5 text-red-100" />
            </div>

            <div 
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-white rounded-xl p-4 flex items-center justify-between cursor-pointer border border-red-200 hover:bg-red-50 active:bg-red-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-700" />
                <span className="text-sm font-bold text-red-700">Delete Account</span>
              </div>
              <ArrowRight className="w-5 h-5 text-red-200" />
            </div>
          </div>
        </div>
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
            className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-5 border border-red-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-red-100 p-2 rounded-full text-red-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-gray-900">Delete Account?</h3>
            </div>
            <p className="text-sm text-gray-500 mb-5">Are you sure you want to delete your delivery account? You will lose access to all your trips and wallet.</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteSubmitting}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-700 font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteSubmitting}
                className="flex-1 h-11 rounded-xl bg-red-600 text-white font-bold disabled:opacity-60"
              >
                {deleteSubmitting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProfileV2;
