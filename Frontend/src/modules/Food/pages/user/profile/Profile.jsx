import { useState, useEffect } from "react";
import { Link, useLocation as useRouterLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ChevronRight,
  Wallet,
  Tag,
  Bookmark,
  User,
  Leaf,
  Palette,
  Heart,
  Building2,
  Moon,
  Sun,
  Check,
  Percent,
  Info,
  PenSquare,
  AlertTriangle,
  Settings as SettingsIcon,
  Power,
  ShoppingCart,
  MapPin,
  Share2,
  Calendar,
} from "lucide-react";

import AnimatedPage from "@food/components/user/AnimatedPage";
import { Card, CardContent } from "@food/components/ui/card";
import { Button } from "@food/components/ui/button";
import { useProfile } from "@food/context/ProfileContext";
import { useLocationSelector } from "@food/components/user/UserLayout";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@food/components/ui/avatar";
import { useCompanyName } from "@food/hooks/useCompanyName";
import OptimizedImage from "@food/components/OptimizedImage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@food/components/ui/dialog";
import { authAPI, userAPI } from "@food/api";
import { firebaseAuth } from "@food/firebase";
import { clearModuleAuth } from "@food/utils/auth";
import { toast } from "sonner";
import { useTheme } from "next-themes";
const debugLog = (...args) => { };
const debugWarn = (...args) => { };
const debugError = (...args) => { };
const USER_SESSION_PREFERENCE_KEYS = ["userVegMode", "food-under-250-filters"];

import { registerWebPushForCurrentModule } from "@food/utils/firebaseMessaging";

export default function Profile() {
  const { userProfile, vegMode, setVegMode, getDefaultAddress, addresses } =
    useProfile();
  const { openLocationSelector } = useLocationSelector();
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();
  const routeSearchParams = new URLSearchParams(routerLocation.search);
  const companyName = useCompanyName();
  const { theme, setTheme } = useTheme();
  const isSharedProfile = routerLocation.pathname.startsWith("/profile");
  const profileSource = routeSearchParams.get("from");
  const isQuickProfile =
    routerLocation.pathname.startsWith("/quick") ||
    (isSharedProfile && profileSource === "quick");
  const sharedSourceQuery = profileSource ? `?from=${profileSource}` : "";
  const backPath = isQuickProfile ? "/quick" : "/food/user";
  const walletPath = isQuickProfile ? "/quick/wallet" : "/food/user/wallet";
  const couponPath = isSharedProfile
    ? `/profile/coupons${sharedSourceQuery}`
    : isQuickProfile
      ? "/quick/offers"
      : "/user/profile/coupons";
  const cartPath = isQuickProfile ? "/quick/cart" : "/cart";
  const profileEditPath = isSharedProfile
    ? `/profile/edit${sharedSourceQuery}`
    : isQuickProfile
      ? "/quick/profile/edit"
      : "/user/profile/edit";
  const supportPath = isSharedProfile
    ? `/profile/support${sharedSourceQuery}`
    : isQuickProfile
      ? "/quick/support"
      : "/user/profile/support";
  const aboutPath = isSharedProfile
    ? `/profile/about${sharedSourceQuery}`
    : isQuickProfile
      ? "/quick/about"
      : "/user/profile/about";
  const defaultAddress = getDefaultAddress?.();
  const savedAddressSummary = defaultAddress
    ? [
      defaultAddress.street,
      defaultAddress.additionalDetails,
      defaultAddress.city,
      defaultAddress.state,
      defaultAddress.zipCode,
    ]
      .filter(Boolean)
      .join(", ")
    : "No address saved. Tap to save Home, Work, or Other.";

  // Popup states
  const [vegModeOpen, setVegModeOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [deleteAccountConfirmOpen, setDeleteAccountConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [referralReward, setReferralReward] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);

  // Trigger web push registration when profile mounts to ensure FCM token is saved
  useEffect(() => {
    registerWebPushForCurrentModule().catch(console.error);
  }, []);

  const handleVegModeUpdate = (nextValue) => {
    setVegMode(nextValue);
    localStorage.setItem("userVegMode", String(nextValue));
  };

  // Settings states
  const [appearance, setAppearance] = useState("light");

  useEffect(() => {
    if (theme !== "light") {
      setTheme("light");
    }
    localStorage.setItem("appTheme", "light");
    // window.dispatchEvent(new CustomEvent("app-theme-changed", { detail: { theme: "light" } }));
  }, [theme, setTheme]);

  // Get first letter of name for avatar
  const avatarInitial =
    userProfile?.name?.charAt(0)?.toUpperCase() ||
    userProfile?.phone?.charAt(1)?.toUpperCase() ||
    "U";
  const displayName = userProfile?.name || userProfile?.phone || "User";
  // Only show email if it exists and is valid, otherwise show phone or "Not available"
  const hasValidEmail =
    userProfile?.email &&
    userProfile.email.trim() !== "" &&
    userProfile.email.includes("@");
  const displayEmail = hasValidEmail
    ? userProfile.email
    : userProfile?.phone || "Not available";

  // Calculate profile completion percentage
  const calculateProfileCompletion = () => {
    if (!userProfile) return 0;

    // Helper function to check if date field is filled (handles Date objects, date strings, ISO strings)
    const isDateFilled = (dateField) => {
      if (!dateField) return false;

      // Check if it's a Date object
      if (dateField instanceof Date) {
        return !isNaN(dateField.getTime());
      }

      // Check if it's a string
      if (typeof dateField === "string") {
        const trimmed = dateField.trim();
        if (trimmed === "" || trimmed === "null" || trimmed === "undefined")
          return false;

        // Try to parse as date (handles various formats: YYYY-MM-DD, ISO strings, etc.)
        const date = new Date(trimmed);
        if (!isNaN(date.getTime())) {
          // Valid date
          return true;
        }
      }

      return false;
    };
    // Check name - must have value
    const hasName = !!(
      userProfile.name &&
      typeof userProfile.name === "string" &&
      userProfile.name.trim() !== ""
    );

    // Check contact - phone OR email (at least one)
    const hasPhone = !!(
      userProfile.phone &&
      typeof userProfile.phone === "string" &&
      userProfile.phone.trim() !== ""
    );
    const hasContact = hasPhone || hasValidEmail;

    // Check profile image - must have URL string or object with URL
    const hasImage = !!(
      userProfile.profileImage &&
      (typeof userProfile.profileImage === "string"
        ? userProfile.profileImage.trim() !== ""
        : typeof userProfile.profileImage?.url === "string" &&
          userProfile.profileImage.url.trim() !== "") &&
      userProfile.profileImage !== "null" &&
      userProfile.profileImage !== "undefined"
    );

    // Check date of birth
    const hasDateOfBirth = isDateFilled(userProfile.dateOfBirth);

    // Check gender - must be valid value
    const validGenders = ["male", "female", "other", "prefer-not-to-say"];
    const hasGender = !!(
      userProfile.gender &&
      typeof userProfile.gender === "string" &&
      userProfile.gender.trim() !== "" &&
      validGenders.includes(userProfile.gender.trim().toLowerCase())
    );

    // Required fields only (anniversary is NOT counted - it's optional)
    // Only these 5 fields count towards 100%
    const requiredFields = {
      name: hasName,
      contact: hasContact,
      profileImage: hasImage,
      dateOfBirth: hasDateOfBirth,
      gender: hasGender,
    };

    const totalRequiredFields = 5; // Fixed: name, contact, profileImage, dateOfBirth, gender
    const completedRequiredFields =
      Object.values(requiredFields).filter(Boolean).length;

    // Calculate percentage based ONLY on required fields (anniversary NOT included)
    const percentage = Math.round(
      (completedRequiredFields / totalRequiredFields) * 100,
    );

    // Always log for debugging (remove in production if needed)
    debugLog("?? Profile completion check:", {
      requiredFields,
      completedRequiredFields,
      totalRequiredFields,
      percentage,
      fieldStatus: {
        name: hasName ? "?" : "?",
        contact: hasContact ? "?" : "?",
        profileImage: hasImage ? "?" : "?",
        dateOfBirth: hasDateOfBirth ? "?" : "?",
        gender: hasGender ? "?" : "?",
      },
      rawData: {
        name: userProfile.name || "missing",
        phone: userProfile.phone || "missing",
        email: userProfile.email || "missing",
        profileImage: userProfile.profileImage ? "exists" : "missing",
        dateOfBirth: userProfile.dateOfBirth
          ? String(userProfile.dateOfBirth)
          : "missing",
        gender: userProfile.gender || "missing",
      },
    });

    return percentage;
  };

  const profileCompletion = calculateProfileCompletion();
  const isComplete = profileCompletion === 100;
  useEffect(() => {
    let mounted = true;
    userAPI
      .getReferralStats()
      .then((res) => {
        const reward = res?.data?.data?.stats?.rewardAmount;
        if (mounted) setReferralReward(Number(reward) || 0);
      })
      .catch(() => { });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    userAPI
      .getWallet()
      .then((res) => {
        const w = res?.data?.data?.wallet || res?.data?.wallet;
        const bal = Number(w?.balance);
        if (mounted) setWalletBalance(Number.isFinite(bal) ? bal : 0);
      })
      .catch(() => { });
    return () => {
      mounted = false;
    };
  }, []);

  const refId =
    userProfile?._id || userProfile?.id || userProfile?.referralCode || "";
  const referralLink = refId
    ? `${window.location.origin}/food/user/auth/login?ref=${encodeURIComponent(String(refId))}`
    : "";

  const handleShareReferral = async () => {
    if (!referralLink) return;
    const rewardText = referralReward > 0 ? `\u20B9${referralReward}` : "rewards";
    const shareText = `Join ${companyName} and earn ${rewardText}.`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${companyName} referral`,
          text: shareText,
          url: referralLink,
        });
      } else {
        const fallbackUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${referralLink}`)}`;
        window.open(fallbackUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      debugError("Failed to share referral:", error);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    if (isLoggingOut) return; // Prevent multiple clicks

    setIsLoggingOut(true);

    try {
      // Call backend logout API to invalidate refresh token
      try {
        let fcmToken = null;
        let platform = "web";
        try {
          if (typeof window !== "undefined") {
            if (window.flutter_inappwebview) {
              platform = "mobile";
              const handlerNames = [
                "getFcmToken",
                "getFCMToken",
                "getPushToken",
                "getFirebaseToken",
              ];
              for (const handlerName of handlerNames) {
                try {
                  const t = await window.flutter_inappwebview.callHandler(
                    handlerName,
                    { module: "user" },
                  );
                  if (t && typeof t === "string" && t.length > 20) {
                    fcmToken = t.trim();
                    break;
                  }
                } catch (e) { }
              }
            } else {
              fcmToken =
                localStorage.getItem("fcm_web_registered_token_user") || null;
            }
          }
        } catch (e) {
          console.warn("Failed to get FCM token during logout", e);
        }
        await authAPI.logout(null, fcmToken, platform);
      } catch (apiError) {
        // Continue with logout even if API call fails (network issues, etc.)
        debugWarn(
          "Logout API call failed, continuing with local cleanup:",
          apiError,
        );
      }

      // Sign out from Firebase if user logged in via Google
      try {
        const { signOut } = await import("firebase/auth");
        // Firebase Auth is lazy-initialized now; only attempt sign out if it was actually used
        if (firebaseAuth) {
           const currentUser = firebaseAuth.currentUser;
           if (currentUser) {
             await signOut(firebaseAuth);
           }
        }
      } catch (firebaseError) {
        // Continue even if Firebase logout fails
        debugWarn(
          "Firebase logout failed, continuing with local cleanup:",
          firebaseError,
        );
      }

      // Clear user module authentication data using utility function
      clearModuleAuth("user");

      // Clear legacy token data for backward compatibility
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user_authenticated");
      localStorage.removeItem("user_user");
      localStorage.removeItem("user");
      localStorage.removeItem("cart");
      USER_SESSION_PREFERENCE_KEYS.forEach((key) => localStorage.removeItem(key));

      // Dispatch auth change event to notify other components
      window.dispatchEvent(new Event("userAuthChanged"));

      // Return to the shared login screen after logout.
      navigate("/user/auth/login", { replace: true });
    } catch (err) {
      // Even if there's an error, we should still clear local data and logout
      debugError("Error during logout:", err);

      // Clear local data anyway using utility function
      clearModuleAuth("user");

      // Clear legacy token data for backward compatibility
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user_authenticated");
      localStorage.removeItem("user_user");
      localStorage.removeItem("user");
      localStorage.removeItem("cart");
      USER_SESSION_PREFERENCE_KEYS.forEach((key) => localStorage.removeItem(key));
      window.dispatchEvent(new Event("userAuthChanged"));

      // Still return to the shared login screen.
      navigate("/user/auth/login", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleLogoutClick = () => {
    if (isLoggingOut) return;
    setLogoutConfirmOpen(true);
  };

  const handleAddressesClick = () => {
    openLocationSelector();
  };

  return (
    <AnimatedPage className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a] pt-0 mt-0">
      {/* ===================================================================== */}
      {/* MOBILE VIEW (Strictly < 768px: 100% Unchanged original mobile UI)     */}
      {/* ===================================================================== */}
      <div className="md:hidden max-w-md mx-auto px-4 pt-0 mt-0 pb-20 sm:pb-24">
        {/* Header: Back Arrow */}
        <div className="flex items-center mb-0 mt-0 sm:mb-4">
          <Link to={backPath}>
            <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
              <ArrowLeft className="h-5 w-5 text-black dark:text-white" />
            </Button>
          </Link>
        </div>

        {/* Profile Info Card */}
        <Card className="bg-white dark:bg-[#1a1a1a] rounded-2xl py-0 pt-1 shadow-xs mb-0 border-0 dark:border-gray-800 overflow-hidden">
          <CardContent className="p-4 py-0 pt-2">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-start gap-4">
                <motion.div
                  whileHover={{ scale: 1.05, rotate: 3 }}
                  transition={{ duration: 0.3, type: "spring", stiffness: 300 }}>
                  <Avatar className="h-16 w-16 bg-primary-orange/10 border-0">
                    {userProfile?.profileImage && (
                      <AvatarImage
                        src={
                          typeof userProfile.profileImage === "string"
                            ? userProfile.profileImage.trim() || undefined
                            : userProfile.profileImage?.url || undefined
                        }
                        alt={displayName}
                      />
                    )}
                    <AvatarFallback className="bg-primary-orange/10 text-primary-orange text-2xl font-semibold">
                      {avatarInitial}
                    </AvatarFallback>
                  </Avatar>
                </motion.div>
                <div className="flex-1 pt-1">
                  <h2 className="text-xl font-bold text-black dark:text-white mb-0.5">
                    {displayName}
                  </h2>
                  {hasValidEmail && (
                    <p className="text-sm text-black dark:text-gray-300 mb-0.5">
                      {userProfile.email}
                    </p>
                  )}
                  {userProfile?.phone && (
                    <p
                      className={`text-sm ${hasValidEmail ? "text-gray-600 dark:text-gray-400" : "text-black dark:text-white"} mb-1`}>
                      {userProfile.phone}
                    </p>
                  )}
                  {!hasValidEmail && !userProfile?.phone && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      Not available
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Options */}
        <div className="space-y-2 mb-4 mt-3">
          <Link to={profileEditPath} className="block">
            <motion.div
              whileHover={{ x: 4, scale: 1.01 }}
              transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
              <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      transition={{ duration: 0.3 }}>
                      <User className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    </motion.div>
                    <span className="text-base font-medium text-gray-900 dark:text-white">
                      Your profile
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <motion.span
                      className={`text-xs font-medium px-2 py-1 rounded ${isComplete
                          ? "bg-primary-orange/10 text-primary-orange border border-primary-orange/30"
                          : "bg-primary-orange/5 text-primary-orange"
                        }`}
                      whileHover={{ scale: 1.1 }}
                      transition={{ duration: 0.2 }}>
                      {profileCompletion}% completed
                    </motion.span>
                    <motion.div
                      whileHover={{ x: 4 }}
                      transition={{ duration: 0.2 }}>
                      <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </Link>

          <Link to={walletPath} className="block">
            <motion.div
              whileHover={{ x: 4, scale: 1.01 }}
              transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
              <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      transition={{ duration: 0.3 }}>
                      <Wallet className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    </motion.div>
                    <span className="text-base font-medium text-gray-900 dark:text-white">
                      {companyName} Money
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-primary-orange">
                      {"\u20B9"}{Number(walletBalance || 0).toFixed(0)}
                    </span>
                    <motion.div
                      whileHover={{ x: 4 }}
                      transition={{ duration: 0.2 }}>
                      <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </Link>

          <Link to={couponPath} className="block">
            <motion.div
              whileHover={{ x: 4, scale: 1.01 }}
              transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
              <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      transition={{ duration: 0.3 }}>
                      <Tag className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    </motion.div>
                    <span className="text-base font-medium text-gray-900 dark:text-white">
                      {isQuickProfile ? "Offers & coupons" : "Your coupons"}
                    </span>
                  </div>
                  <motion.div
                    whileHover={{ x: 4 }}
                    transition={{ duration: 0.2 }}>
                    <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          </Link>

          <Link to={cartPath} className="block">
            <motion.div
              whileHover={{ x: 4, scale: 1.01 }}
              transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
              <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      transition={{ duration: 0.3 }}>
                      <ShoppingCart className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    </motion.div>
                    <span className="text-base font-medium text-gray-900 dark:text-white">
                      Your cart
                    </span>
                  </div>
                  <motion.div
                    whileHover={{ x: 4 }}
                    transition={{ duration: 0.2 }}>
                    <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          </Link>

          <Link to="/user/profile/refer-earn" className="block">
            <motion.div
              whileHover={{ x: 4, scale: 1.01 }}
              transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
            <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      transition={{ duration: 0.3 }}>
                      <Tag className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    </motion.div>
                    <span className="text-base font-medium text-gray-900 dark:text-white">
                      Refer & Earn
                    </span>
                  </div>
                  {referralReward > 0 && (
                    <span className="text-xs font-semibold px-2 py-1 rounded bg-primary-orange/10 text-primary-orange">
                      Earn {"\u20B9"}{referralReward}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Invite a friend. Reward is added to your wallet when they
                    sign up.
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleShareReferral();
                    }}
                    className="inline-flex items-center gap-1 text-xs text-[#FE5502] font-medium ml-2 px-2 py-1 rounded-md"
                    disabled={!referralLink}>
                    <Share2 className="h-3.5 w-3.5" />
                    Refer
                  </button>
                </div>
              </CardContent>
            </Card>
            </motion.div>
          </Link>

          <motion.div
            whileHover={{ x: 4, scale: 1.01 }}
            transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
            <Card
              className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer"
              onClick={handleAddressesClick}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <motion.div
                    className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
                    whileHover={{ rotate: 15, scale: 1.1 }}
                    transition={{ duration: 0.3 }}>
                    <MapPin className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                  </motion.div>
                  <div className="min-w-0">
                    <p className="text-base font-medium text-gray-900 dark:text-white">
                      Saved addresses
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {savedAddressSummary}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                    {addresses?.length || 0}
                  </span>
                  <motion.div
                    whileHover={{ x: 4 }}
                    transition={{ duration: 0.2 }}>
                    <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </motion.div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            whileHover={{ x: 4, scale: 1.01 }}
            transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
            <Card
              className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer"
              onClick={() => setVegModeOpen(true)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div
                    className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
                    whileHover={{ rotate: 15, scale: 1.1 }}
                    transition={{ duration: 0.3 }}>
                    <Leaf className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                  </motion.div>
                  <span className="text-base font-medium text-gray-900 dark:text-white">
                    Veg Mode
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <motion.span
                    className="text-base font-medium text-gray-900 dark:text-white"
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.2 }}>
                    {vegMode ? "ON" : "OFF"}
                  </motion.span>
                  <motion.div
                    whileHover={{ x: 4 }}
                    transition={{ duration: 0.2 }}>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </motion.div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Food Section */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-1 h-4 bg-[#FE5502] rounded"></div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Food
            </h3>
          </div>
          <div className="space-y-2">
            <Link to="/food/user/profile/wishlist" className="block">
              <motion.div
                whileHover={{ x: 4, scale: 1.01 }}
                transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
                <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <motion.div
                        className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
                        whileHover={{ rotate: 15, scale: 1.1 }}
                        transition={{ duration: 0.3 }}>
                        <Heart className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                      </motion.div>
                      <span className="text-base font-medium text-gray-900 dark:text-white">
                        Food wishlist
                      </span>
                    </div>
                    <motion.div
                      whileHover={{ x: 4 }}
                      transition={{ duration: 0.2 }}>
                      <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            </Link>

            <Link to="/user/orders" className="block">
              <motion.div
                whileHover={{ x: 4, scale: 1.01 }}
                transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
                <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <motion.div
                        className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
                        whileHover={{ rotate: 15, scale: 1.1 }}
                        transition={{ duration: 0.3 }}>
                        <Building2 className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                      </motion.div>
                      <span className="text-base font-medium text-gray-900 dark:text-white">
                        Food orders
                      </span>
                    </div>
                    <motion.div
                      whileHover={{ x: 4 }}
                      transition={{ duration: 0.2 }}>
                      <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            </Link>
          </div>
        </div>

        {/* Quick Commerce Section */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-1 h-4 bg-[#0c831f] rounded"></div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Quick Commerce
            </h3>
          </div>
          <div className="space-y-2">
            <Link to="/quick/orders" className="block">
              <motion.div
                whileHover={{ x: 4, scale: 1.01 }}
                transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
                <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <motion.div
                        className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
                        whileHover={{ rotate: 15, scale: 1.1 }}
                        transition={{ duration: 0.3 }}>
                        <Building2 className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                      </motion.div>
                      <span className="text-base font-medium text-gray-900 dark:text-white">
                        Quick orders
                      </span>
                    </div>
                    <motion.div whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                      <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            </Link>

            <Link to="/quick/transactions" className="block">
              <motion.div
                whileHover={{ x: 4, scale: 1.01 }}
                transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
                <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <motion.div
                        className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
                        whileHover={{ rotate: 15, scale: 1.1 }}
                        transition={{ duration: 0.3 }}>
                        <Percent className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                      </motion.div>
                      <span className="text-base font-medium text-gray-900 dark:text-white">
                        Order transactions
                      </span>
                    </div>
                    <motion.div whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                      <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            </Link>

            <Link to="/quick/wishlist" className="block">
              <motion.div
                whileHover={{ x: 4, scale: 1.01 }}
                transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
                <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <motion.div
                        className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
                        whileHover={{ rotate: 15, scale: 1.1 }}
                        transition={{ duration: 0.3 }}>
                        <Bookmark className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                      </motion.div>
                      <span className="text-base font-medium text-gray-900 dark:text-white">
                        Quick wishlist
                      </span>
                    </div>
                    <motion.div whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                      <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            </Link>
          </div>
        </div>

        {/* More Section */}
        <div className="mb-8 pb-8">
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-1 h-4 bg-[#FE5502] rounded"></div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              More
            </h3>
          </div>
          <div className="space-y-2">
            <Link to={supportPath} className="block">
              <motion.div
                whileHover={{ x: 4, scale: 1.01 }}
                transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
                <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <motion.div
                        className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
                        whileHover={{ rotate: 15, scale: 1.1 }}
                        transition={{ duration: 0.3 }}>
                        <SettingsIcon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                      </motion.div>
                      <span className="text-base font-medium text-gray-900 dark:text-white">
                        Help & Support
                      </span>
                    </div>
                    <motion.div
                      whileHover={{ x: 4 }}
                      transition={{ duration: 0.2 }}>
                      <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            </Link>

            <Link to={aboutPath} className="block">
              <motion.div
                whileHover={{ x: 4, scale: 1.01 }}
                transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
                <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <motion.div
                        className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
                        whileHover={{ rotate: 15, scale: 1.1 }}
                        transition={{ duration: 0.3 }}>
                        <Info className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                      </motion.div>
                      <span className="text-base font-medium text-gray-900 dark:text-white">
                        About
                      </span>
                    </div>
                    <motion.div
                      whileHover={{ x: 4 }}
                      transition={{ duration: 0.2 }}>
                      <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            </Link>

            <Link to="/user/profile/report-safety-emergency" className="block">
              <motion.div
                whileHover={{ x: 4, scale: 1.01 }}
                transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
                <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <motion.div
                        className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
                        whileHover={{ rotate: 15, scale: 1.1 }}
                        transition={{ duration: 0.3 }}>
                        <AlertTriangle className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                      </motion.div>
                      <span className="text-base font-medium text-gray-900 dark:text-white">
                        Report a safety emergency
                      </span>
                    </div>
                    <motion.div
                      whileHover={{ x: 4 }}
                      transition={{ duration: 0.2 }}>
                      <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            </Link>

            <motion.div
              whileHover={{ x: 4, scale: 1.01 }}
              transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
              <Card
                className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setDeleteAccountConfirmOpen(true)}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="bg-red-50 dark:bg-red-900/20 rounded-full p-2"
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      transition={{ duration: 0.3 }}>
                      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-500" />
                    </motion.div>
                    <span className="text-base font-medium text-red-600 dark:text-red-500">
                      Delete Account
                    </span>
                  </div>
                  <motion.div
                    whileHover={{ x: 4 }}
                    transition={{ duration: 0.2 }}>
                    <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              whileHover={{ x: 4, scale: 1.01 }}
              transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
              <Card
                className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleLogoutClick}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      transition={{ duration: 0.3 }}>
                      <Power
                        className={`h-5 w-5 text-gray-700 dark:text-gray-300 ${isLoggingOut ? "animate-pulse" : ""}`}
                      />
                    </motion.div>
                    <span className="text-base font-medium text-gray-900 dark:text-white">
                      {isLoggingOut ? "Logging out..." : "Log out"}
                    </span>
                  </div>
                  <motion.div
                    whileHover={{ x: 4 }}
                    transition={{ duration: 0.2 }}>
                    <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* DESKTOP / WEB VIEW (Screen width >= 768px: Polished Account Dashboard) */}
      {/* ===================================================================== */}
      <div className="hidden md:block max-w-6xl mx-auto px-6 lg:px-8 pt-6 pb-24">
        {/* Top Header & Breadcrumb */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200/80 dark:border-gray-800/80">
          <div className="flex items-center gap-3">
            <Link
              to={backPath}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-[#FE5502] transition-colors shadow-xs"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{isQuickProfile ? "Back to Quick Store" : "Back to Food"}</span>
            </Link>
            <div className="h-4 w-px bg-gray-300 dark:bg-gray-700" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Account & Settings
              </h1>
            </div>
          </div>

          <Link to={profileEditPath}>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-[#FE5502] text-[#FE5502] hover:bg-[#FE5502] hover:text-white transition-all gap-2 shadow-xs font-medium"
            >
              <PenSquare className="h-4 w-4" />
              Edit Profile
            </Button>
          </Link>
        </div>

        {/* 2-Column Desktop Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: Profile Overview, Wallet, Quick Preferences (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* User Profile Card */}
            <Card className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
              {/* Header Gradient */}
              <div className="h-20 bg-gradient-to-r from-orange-500/10 via-[#FE5502]/15 to-amber-500/10 dark:from-orange-950/30 dark:to-neutral-900 relative border-b border-orange-500/10" />

              <CardContent className="px-6 pb-6 pt-0 relative">
                {/* Avatar with ring */}
                <div className="flex justify-center -mt-10 mb-3">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Avatar className="h-20 w-20 ring-4 ring-white dark:ring-[#1a1a1a] shadow-md bg-orange-50 dark:bg-orange-950/40">
                      {userProfile?.profileImage && (
                        <AvatarImage
                          src={
                            typeof userProfile.profileImage === "string"
                              ? userProfile.profileImage.trim() || undefined
                              : userProfile.profileImage?.url || undefined
                          }
                          alt={displayName}
                        />
                      )}
                      <AvatarFallback className="bg-primary-orange/15 text-primary-orange text-3xl font-bold">
                        {avatarInitial}
                      </AvatarFallback>
                    </Avatar>
                  </motion.div>
                </div>

                {/* User Info */}
                <div className="text-center">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-0.5">
                    {displayName}
                  </h2>
                  {hasValidEmail && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                      {userProfile.email}
                    </p>
                  )}
                  {userProfile?.phone && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {userProfile.phone}
                    </p>
                  )}
                </div>

                {/* Profile Completion Progress */}
                <div className="mt-5 p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                    <span className="text-gray-700 dark:text-gray-300">
                      Profile Completion
                    </span>
                    <span className="text-[#FE5502] font-bold">
                      {profileCompletion}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#FE5502] to-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${profileCompletion}%` }}
                    />
                  </div>
                </div>

                {/* Quick Edit button */}
                <Link to={profileEditPath} className="block mt-4">
                  <Button
                    variant="outline"
                    className="w-full rounded-xl border-gray-200 dark:border-gray-700 hover:border-[#FE5502] hover:text-[#FE5502] transition-colors gap-2 text-sm font-medium"
                  >
                    <User className="h-4 w-4" />
                    View & Edit Full Profile
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Wallet & Referral Card */}
            <Card className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
              {/* Wallet Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-[#FE5502] flex items-center justify-center">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                      {companyName} Balance
                    </p>
                    <p className="text-xl font-extrabold text-gray-900 dark:text-white">
                      {"\u20B9"}{Number(walletBalance || 0).toFixed(0)}
                    </p>
                  </div>
                </div>
                <Link to={walletPath}>
                  <Button
                    size="sm"
                    className="rounded-xl bg-[#FE5502] hover:bg-[#e04b02] text-white text-xs font-semibold shadow-xs"
                  >
                    Wallet
                  </Button>
                </Link>
              </div>

              <div className="h-px bg-gray-100 dark:bg-gray-800" />

              {/* Refer & Earn Promo */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Share2 className="h-4 w-4 text-[#FE5502]" />
                    Refer & Earn
                  </span>
                  {referralReward > 0 && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-orange-50 dark:bg-orange-950/50 text-[#FE5502]">
                      Earn {"\u20B9"}{referralReward}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Invite friends to {companyName} and earn rewards in your wallet when they place an order.
                </p>
                <div className="flex items-center gap-2">
                  <Link to="/user/profile/refer-earn" className="flex-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full rounded-xl text-xs font-medium border-gray-200 dark:border-gray-700"
                    >
                      View Details
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    onClick={handleShareReferral}
                    disabled={!referralLink}
                    className="rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-black dark:hover:bg-gray-100 text-xs font-medium px-4"
                  >
                    Share
                  </Button>
                </div>
              </div>
            </Card>

            {/* Quick Preferences: Veg Mode & Addresses */}
            <Card className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 space-y-3">
              {/* Veg Mode Toggle Card */}
              <div
                onClick={() => setVegModeOpen(true)}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${vegMode ? 'bg-green-50 dark:bg-green-950/40 text-green-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                    <Leaf className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-[#FE5502] transition-colors">
                      Veg Mode
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Show purely vegetarian food
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${vegMode ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                    {vegMode ? "ON" : "OFF"}
                  </span>
                  <ChevronRight className="h-4 w-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              <div className="h-px bg-gray-100 dark:bg-gray-800" />

              {/* Saved Addresses */}
              <div
                onClick={handleAddressesClick}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-[#FE5502] flex items-center justify-center shrink-0">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-[#FE5502] transition-colors">
                        Saved Addresses
                      </p>
                      <span className="text-[11px] font-bold px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                        {addresses?.length || 0}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {savedAddressSummary}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:translate-x-0.5 transition-transform shrink-0 ml-2" />
              </div>
            </Card>
          </div>

          {/* RIGHT COLUMN: Grouped Sections in Balanced Grids (8 cols) */}
          <div className="lg:col-span-8 space-y-7">
            {/* 1. Orders & Shopping Section */}
            <div>
              <div className="flex items-center gap-2 mb-3 px-0.5">
                <div className="w-1.5 h-5 bg-[#FE5502] rounded-full"></div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Orders & Activity
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Food Orders */}
                <Link to="/user/orders" className="block group">
                  <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
                    <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-gray-800 shadow-xs hover:shadow-md hover:border-orange-200 dark:hover:border-orange-900/40 transition-all p-4 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-[#FE5502] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-[#FE5502] transition-colors">
                              Food Orders
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              Track past and live restaurant meals
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#FE5502] group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </Card>
                  </motion.div>
                </Link>

                {/* Food Wishlist */}
                <Link to="/food/user/profile/wishlist" className="block group">
                  <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
                    <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-gray-800 shadow-xs hover:shadow-md hover:border-rose-200 dark:hover:border-rose-900/40 transition-all p-4 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Heart className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-rose-500 transition-colors">
                              Food Wishlist
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              Saved restaurants and favorite dishes
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-rose-500 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </Card>
                  </motion.div>
                </Link>

                {/* Quick Orders */}
                <Link to="/quick/orders" className="block group">
                  <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
                    <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-gray-800 shadow-xs hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-900/40 transition-all p-4 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                              Quick Orders
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              Instant grocery and essentials deliveries
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </Card>
                  </motion.div>
                </Link>

                {/* Quick Wishlist */}
                <Link to="/quick/wishlist" className="block group">
                  <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
                    <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-gray-800 shadow-xs hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-900/40 transition-all p-4 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Bookmark className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                              Quick Wishlist
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              Saved grocery items for quick ordering
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </Card>
                  </motion.div>
                </Link>

                {/* Order Transactions */}
                <Link to="/quick/transactions" className="block group">
                  <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
                    <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-gray-800 shadow-xs hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900/40 transition-all p-4 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Percent className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                              Order Transactions
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              Payment status, invoices and receipts
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </Card>
                  </motion.div>
                </Link>

                {/* Your Cart */}
                <Link to={cartPath} className="block group">
                  <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
                    <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-gray-800 shadow-xs hover:shadow-md hover:border-amber-200 dark:hover:border-amber-900/40 transition-all p-4 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <ShoppingCart className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-amber-600 transition-colors">
                              Your Cart
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              Review pending items and checkout
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </Card>
                  </motion.div>
                </Link>
              </div>
            </div>

            {/* 2. Offers & Benefits Section */}
            <div>
              <div className="flex items-center gap-2 mb-3 px-0.5">
                <div className="w-1.5 h-5 bg-amber-500 rounded-full"></div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Offers & Discounts
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Offers & Coupons */}
                <Link to={couponPath} className="block group">
                  <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
                    <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-gray-800 shadow-xs hover:shadow-md hover:border-purple-200 dark:hover:border-purple-900/40 transition-all p-4 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Tag className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 transition-colors">
                              {isQuickProfile ? "Offers & Coupons" : "Your Coupons"}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              Exclusive coupon codes and instant discounts
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </Card>
                  </motion.div>
                </Link>

                {/* Refer & Earn Card */}
                <Link to="/user/profile/refer-earn" className="block group">
                  <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
                    <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-gray-800 shadow-xs hover:shadow-md hover:border-orange-200 dark:hover:border-orange-900/40 transition-all p-4 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-[#FE5502] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Share2 className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-[#FE5502] transition-colors">
                                Refer & Earn Program
                              </h4>
                              {referralReward > 0 && (
                                <span className="text-[11px] font-bold px-1.5 py-0.2 rounded bg-orange-100 dark:bg-orange-900/40 text-[#FE5502]">
                                  ₹{referralReward}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              Earn wallet cash for every friend you refer
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#FE5502] group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </Card>
                  </motion.div>
                </Link>
              </div>
            </div>

            {/* 3. Account & Support Section */}
            <div>
              <div className="flex items-center gap-2 mb-3 px-0.5">
                <div className="w-1.5 h-5 bg-slate-500 rounded-full"></div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Support & Preferences
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Help & Support */}
                <Link to={supportPath} className="block group">
                  <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
                    <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-gray-800 shadow-xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all p-4 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <SettingsIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                              Help & Support
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              Customer support, FAQs and chat help
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </Card>
                  </motion.div>
                </Link>

                {/* About */}
                <Link to={aboutPath} className="block group">
                  <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
                    <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-gray-800 shadow-xs hover:shadow-md hover:border-sky-300 dark:hover:border-sky-700 transition-all p-4 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Info className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-sky-600 transition-colors">
                              About {companyName}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              Legal, terms, refund and privacy policies
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </Card>
                  </motion.div>
                </Link>

                {/* Safety Emergency */}
                <Link to="/user/profile/report-safety-emergency" className="block group">
                  <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
                    <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-gray-800 shadow-xs hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700 transition-all p-4 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <AlertTriangle className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-amber-600 transition-colors">
                              Safety Emergency
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              Urgent incident escalation and safety team
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </Card>
                  </motion.div>
                </Link>

                {/* Log Out */}
                <motion.div
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.2 }}
                  onClick={handleLogoutClick}
                  className="cursor-pointer group"
                >
                  <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-gray-800 shadow-xs hover:shadow-md hover:border-red-200 dark:hover:border-red-900/40 transition-all p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 group-hover:bg-red-50 dark:group-hover:bg-red-950/40 text-gray-700 dark:text-gray-300 group-hover:text-red-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-all">
                          <Power className={`w-5 h-5 ${isLoggingOut ? "animate-pulse" : ""}`} />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-red-600 transition-colors">
                            {isLoggingOut ? "Logging out..." : "Log Out"}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Sign out of your account on this browser
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-red-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </Card>
                </motion.div>
              </div>

              {/* Delete Account Banner (Subtle, at bottom of Support section) */}
              <div className="mt-4 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteAccountConfirmOpen(true)}
                  className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium inline-flex items-center gap-1.5 transition-colors px-1 py-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/20"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Delete Account permanently
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Veg Mode Popup */}
      <Dialog open={vegModeOpen} onOpenChange={setVegModeOpen}>
        <DialogContent className="max-w-sm md:max-w-md lg:max-w-lg w-[calc(100%-2rem)] rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3">
            <DialogTitle className="text-lg font-bold text-gray-900">
              Veg Mode
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              Filter restaurants and dishes based on your dietary preferences
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 px-5 pb-5">
            <button
              onClick={() => {
                handleVegModeUpdate("pure");
                setVegModeOpen(false);
              }}
              className={`w-full p-3 rounded-xl border-2 transition-all flex items-center justify-between ${vegMode
                  ? "border-green-600 bg-green-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
                }`}>
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${vegMode
                      ? "border-green-600 bg-green-600"
                      : "border-gray-300"
                    }`}>
                  {vegMode && <Check className="h-3 w-3 text-white" />}
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900 text-sm">
                    Veg Mode ON
                  </p>
                  <p className="text-xs text-gray-500">
                    Show only vegetarian options
                  </p>
                </div>
              </div>
              <Leaf
                className={`h-5 w-5 ${vegMode ? "text-green-600" : "text-gray-400"}`}
              />
            </button>
            <button
              onClick={() => {
                handleVegModeUpdate(false);
                setVegModeOpen(false);
              }}
              className={`w-full p-3 rounded-xl border-2 transition-all flex items-center justify-between ${!vegMode
                  ? "border-red-600 bg-red-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
                }`}>
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${!vegMode ? "border-red-600 bg-red-600" : "border-gray-300"
                    }`}>
                  {!vegMode && <Check className="h-3 w-3 text-white" />}
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900 text-sm">
                    Veg Mode OFF
                  </p>
                  <p className="text-xs text-gray-500">Show all options</p>
                </div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Logout Confirmation Popup */}
      {logoutConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1a1a1a] p-5 shadow-2xl border border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Log out?
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to log out?
            </p>
            <div className="mt-5 flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => setLogoutConfirmOpen(false)}
                disabled={isLoggingOut}
              >
                No
              </Button>
              <Button
                type="button"
                className="flex-1 rounded-xl bg-[#CB202D] hover:bg-[#b01c27] text-white"
                onClick={() => {
                  setLogoutConfirmOpen(false);
                  handleLogout();
                }}
                disabled={isLoggingOut}
              >
                Yes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Popup */}
      {deleteAccountConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1a1a1a] p-5 shadow-2xl border border-red-200 dark:border-red-900/30">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-full text-red-600 dark:text-red-500">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Delete Account?
              </h3>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to delete your account? You will lose access to all your orders, wallet balance, and saved addresses.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => setDeleteAccountConfirmOpen(false)}
                disabled={isDeletingAccount}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white"
                onClick={async () => {
                  try {
                    setIsDeletingAccount(true);
                    await userAPI.deleteAccount();
                    toast.success("Account deleted successfully");
                  } catch (error) {
                    // If we get 401, it likely means the account was already
                    // deleted/deactivated OR the session expired. Either way,
                    // we should clear auth and redirect to login gracefully.
                    const status = error?.response?.status;
                    if (status === 401) {
                      // Session already invalid — just clear and redirect
                      toast.success("Session ended. Redirecting to login...");
                    } else {
                      toast.error(
                        error?.response?.data?.message ||
                        error?.message ||
                        "Failed to delete account"
                      );
                      setIsDeletingAccount(false);
                      return; // Don't clear auth or navigate on non-401 errors
                    }
                  }
                  // Always clear auth and redirect after successful delete or 401
                  clearModuleAuth();
                  firebaseAuth.signOut().catch(() => {});
                  setDeleteAccountConfirmOpen(false);
                  navigate("/user/auth/login", { replace: true });
                }}
                disabled={isDeletingAccount}
              >
                {isDeletingAccount ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Appearance Popup */}
      {/* <Dialog open={appearanceOpen} onOpenChange={setAppearanceOpen}>
        <DialogContent className="max-w-sm md:max-w-md lg:max-w-lg w-[calc(100%-2rem)] rounded-2xl p-0 overflow-hidden bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-gray-800">
          <DialogHeader className="p-5 pb-3">
            <DialogTitle className="text-lg font-bold text-gray-900 dark:text-white">
              Appearance
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
              Choose your preferred theme
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 px-5 pb-5">
            <button
              onClick={() => {
                setAppearance("light");
                setAppearanceOpen(false);
              }}
              className={`w-full p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${appearance === "light"
                  ? "border-primary bg-orange-50 dark:border-primary dark:bg-orange-900/20"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
                }`}>
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${appearance === "light"
                    ? "border-primary bg-primary dark:border-primary dark:bg-primary"
                    : "border-gray-300 dark:border-gray-600"
                  }`}>
                {appearance === "light" && (
                  <Check className="h-3 w-3 text-white" />
                )}
              </div>
              <Sun className="h-5 w-5 text-yellow-500 dark:text-yellow-400 flex-shrink-0" />
              <div className="text-left">
                <p className="font-medium text-gray-900 dark:text-white text-sm">
                  Light
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Default light theme
                </p>
              </div>
            </button>
            <button
              onClick={() => {
                setAppearance("dark");
                setAppearanceOpen(false);
              }}
              className={`w-full p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${appearance === "dark"
                  ? "border-primary dark:border-primary bg-orange-50 dark:bg-orange-900/20"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
                }`}>
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${appearance === "dark"
                    ? "border-primary bg-primary dark:border-primary dark:bg-primary"
                    : "border-gray-300 dark:border-gray-600"
                  }`}>
                {appearance === "dark" && (
                  <Check className="h-3 w-3 text-white" />
                )}
              </div>
              <Moon className="h-5 w-5 text-gray-600 dark:text-gray-300 flex-shrink-0" />
              <div className="text-left">
                <p className="font-medium text-gray-900 dark:text-white text-sm">
                  Dark
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Dark theme
                </p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog> */}
    </AnimatedPage>
  );
}
