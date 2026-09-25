import { useState, useEffect } from "react";
import { Link, useLocation as useRouterLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ChevronRight,
  Wallet,
  Tag,
  User,
  Leaf,
  Palette,
  Bookmark,
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
  Store,
  Truck,
  ChefHat,
  Loader2,
  Package,
  Shield,
  Facebook,
  Instagram,
  Twitter,
  Linkedin,
  Youtube,
} from "lucide-react";

import { useSettings } from "@core/context/SettingsContext";

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
import { authAPI, userAPI, zoneAPI } from "@food/api";
import { firebaseAuth } from "@food/firebase";
import { clearModuleAuth } from "@food/utils/auth";
import { toast } from "sonner";
import { useTheme } from "next-themes";
const debugLog = (...args) => { };
const debugWarn = (...args) => { };
const debugError = (...args) => { };
const USER_SESSION_PREFERENCE_KEYS = ["food-under-250-filters"];

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
  
  const { settings } = useSettings();
  const socialLinks = settings?.socialLinks || {};
  // A module is on unless the admin explicitly switched it off (Global Settings > Modules).
  const quickCommerceEnabled = settings?.modules?.quickCommerce !== false;
  const isSharedProfile = routerLocation.pathname.startsWith("/profile");
  const profileSource = routeSearchParams.get("from");

  // Role Requests States
  const [becomeRestaurantOpen, setBecomeRestaurantOpen] = useState(false);
  const [becomeSellerOpen, setBecomeSellerOpen] = useState(false);
  const [becomeDeliveryOpen, setBecomeDeliveryOpen] = useState(false);
  const [zones, setZones] = useState([]);
  const [loadingZones, setLoadingZones] = useState(false);
  const [myRoleRequests, setMyRoleRequests] = useState([]);
  const [editingRequestId, setEditingRequestId] = useState(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedStatusRequest, setSelectedStatusRequest] = useState(null);
  const [loadingMyRequests, setLoadingMyRequests] = useState(false);

  const [restaurantForm, setRestaurantForm] = useState({
    restaurantName: "",
    pureVegRestaurant: "false",
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    primaryContactNumber: "",
    zoneId: "",
    formattedAddress: "",
    addressLine1: "",
    addressLine2: "",
    area: "",
    city: "",
    state: "",
    pincode: "",
    landmark: "",
  });

  const [sellerForm, setSellerForm] = useState({
    name: "",
    shopName: "",
    email: "",
    phone: "",
    zoneId: "",
    address: "",
    businessType: "Grocery",
    alternatePhone: "",
    supportEmail: "",
    openingTime: "09:00",
    closingTime: "21:00",
  });

  const [deliveryForm, setDeliveryForm] = useState({
    name: "",
    email: "",
    address: "",
    city: "",
    state: "",
    vehicleType: "bike",
    vehicleName: "",
    vehicleNumber: "",
    drivingLicenseNumber: "",
    panNumber: "",
    aadharNumber: "",
  });

  const [submittingRole, setSubmittingRole] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoadingZones(true);
    zoneAPI.getPublicZones()
      .then(res => {
        const list = res?.data?.data?.zones || res?.data?.zones || [];
        if (mounted) setZones(list);
      })
      .catch(err => console.error("Error loading zones:", err))
      .finally(() => {
        if (mounted) setLoadingZones(false);
      });
    return () => { mounted = false; };
  }, []);

  const fetchMyRoleRequests = async () => {
    try {
      setLoadingMyRequests(true);
      const res = await userAPI.getMyRoleRequests();
      const list = res?.data?.data || res?.data || [];
      setMyRoleRequests(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Error fetching my role requests:", err);
    } finally {
      setLoadingMyRequests(false);
    }
  };

  useEffect(() => {
    fetchMyRoleRequests();
  }, []);

  const handleBecomeRoleClick = (role, openFormCallback) => {
    const existing = myRoleRequests.find(r => r.role === role);
    if (existing) {
      setSelectedStatusRequest(existing);
      setStatusModalOpen(true);
    } else {
      setEditingRequestId(null);
      openFormCallback();
    }
  };

  const handleEditRequest = (request) => {
    setEditingRequestId(request._id || request.id);
    setStatusModalOpen(false);
    
    const details = request.details || {};
    if (request.role === "RESTAURANT") {
      setRestaurantForm({
        restaurantName: details.restaurantName || "",
        pureVegRestaurant: details.pureVegRestaurant ? "true" : "false",
        ownerName: details.ownerName || "",
        ownerEmail: details.ownerEmail || "",
        ownerPhone: details.ownerPhone || "",
        primaryContactNumber: details.primaryContactNumber || "",
        zoneId: details.zoneId || "",
        addressLine1: details.location?.addressLine1 || "",
        addressLine2: details.location?.addressLine2 || "",
        area: details.location?.area || "",
        city: details.location?.city || "",
        state: details.location?.state || "",
        pincode: details.location?.pincode || "",
        landmark: details.location?.landmark || "",
      });
      setBecomeRestaurantOpen(true);
    } else if (request.role === "SELLER") {
      setSellerForm({
        name: details.name || "",
        shopName: details.shopName || "",
        email: details.email || "",
        phone: details.phone || "",
        zoneId: details.zoneId || "",
        address: details.address || "",
        businessType: details.businessType || "Grocery",
        alternatePhone: details.alternatePhone || "",
        supportEmail: details.supportEmail || "",
        openingTime: details.openingHours?.split(" - ")[0] || "09:00",
        closingTime: details.openingHours?.split(" - ")[1] || "21:00",
      });
      setBecomeSellerOpen(true);
    } else if (request.role === "DELIVERY_BOY") {
      setDeliveryForm({
        name: details.name || "",
        email: details.email || "",
        address: details.address || "",
        city: details.city || "",
        state: details.state || "",
        vehicleType: details.vehicleType || "bike",
        vehicleName: details.vehicleName || "",
        vehicleNumber: details.vehicleNumber || "",
        drivingLicenseNumber: details.drivingLicenseNumber || "",
        panNumber: details.panNumber || "",
        aadharNumber: details.aadharNumber || "",
      });
      setBecomeDeliveryOpen(true);
    }
  };

  const handleDeleteRequest = async (request) => {
    try {
      const reqId = request._id || request.id;
      const res = await userAPI.deleteRoleRequest(reqId);
      if (res?.data?.success || res?.success) {
        toast.success("Role request deleted successfully!");
        setStatusModalOpen(false);
        fetchMyRoleRequests();
      } else {
        toast.error(res?.data?.message || "Failed to delete role request.");
      }
    } catch (err) {
      console.error("Error deleting request:", err);
      toast.error(err?.response?.data?.message || "Failed to delete role request.");
    }
  };

  useEffect(() => {
    if (userProfile) {
      setRestaurantForm(prev => ({
        ...prev,
        ownerPhone: userProfile.phone || "",
        primaryContactNumber: userProfile.phone || "",
        ownerName: userProfile.name || prev.ownerName,
        ownerEmail: userProfile.email || prev.ownerEmail,
      }));
      setSellerForm(prev => ({
        ...prev,
        phone: userProfile.phone || "",
        alternatePhone: userProfile.alternatePhone || "",
        name: userProfile.name || prev.name,
        email: userProfile.email || prev.email,
        supportEmail: userProfile.email || prev.supportEmail,
      }));
      setDeliveryForm(prev => ({
        ...prev,
        name: userProfile.name || prev.name,
        email: userProfile.email || prev.email,
        phone: userProfile.phone || "",
      }));
    }
  }, [userProfile]);

  const handleBecomeRestaurantSubmit = async (e) => {
    e.preventDefault();
    if (!restaurantForm.restaurantName || !restaurantForm.ownerName || !restaurantForm.ownerEmail || !restaurantForm.ownerPhone || !restaurantForm.zoneId || !restaurantForm.addressLine1 || !restaurantForm.city || !restaurantForm.state || !restaurantForm.pincode) {
      toast.error("Please fill in all required fields.");
      return;
    }
    
    setSubmittingRole(true);
    try {
      const details = {
        restaurantName: restaurantForm.restaurantName,
        pureVegRestaurant: restaurantForm.pureVegRestaurant === "true",
        ownerName: restaurantForm.ownerName,
        ownerEmail: restaurantForm.ownerEmail,
        ownerPhone: restaurantForm.ownerPhone,
        primaryContactNumber: restaurantForm.primaryContactNumber,
        zoneId: restaurantForm.zoneId,
        location: {
          formattedAddress: `${restaurantForm.addressLine1}${restaurantForm.addressLine2 ? ", " + restaurantForm.addressLine2 : ""}, ${restaurantForm.city}, ${restaurantForm.state} - ${restaurantForm.pincode}`,
          addressLine1: restaurantForm.addressLine1,
          addressLine2: restaurantForm.addressLine2,
          area: restaurantForm.area,
          city: restaurantForm.city,
          state: restaurantForm.state,
          pincode: restaurantForm.pincode,
          landmark: restaurantForm.landmark,
        }
      };
      
      if (editingRequestId) {
        await userAPI.updateRoleRequest(editingRequestId, details);
        toast.success("Your restaurant onboard request was updated successfully!");
      } else {
        await userAPI.submitRoleRequest("RESTAURANT", details);
        toast.success("Your restaurant onboard request was submitted successfully for approval!");
      }
      setEditingRequestId(null);
      setBecomeRestaurantOpen(false);
      fetchMyRoleRequests();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to submit request.");
    } finally {
      setSubmittingRole(false);
    }
  };

  const handleBecomeSellerSubmit = async (e) => {
    e.preventDefault();
    if (!sellerForm.name || !sellerForm.shopName || !sellerForm.email || !sellerForm.phone || !sellerForm.zoneId || !sellerForm.address || !sellerForm.supportEmail || !sellerForm.openingTime || !sellerForm.closingTime) {
      toast.error("Please fill in all required fields.");
      return;
    }
    
    setSubmittingRole(true);
    try {
      const details = {
        name: sellerForm.name,
        shopName: sellerForm.shopName,
        email: sellerForm.email,
        phone: sellerForm.phone,
        zoneId: sellerForm.zoneId,
        address: sellerForm.address,
        businessType: sellerForm.businessType,
        alternatePhone: sellerForm.alternatePhone,
        supportEmail: sellerForm.supportEmail,
        openingHours: `${sellerForm.openingTime} - ${sellerForm.closingTime}`,
      };
      
      if (editingRequestId) {
        await userAPI.updateRoleRequest(editingRequestId, details);
        toast.success("Your seller request was updated successfully!");
      } else {
        await userAPI.submitRoleRequest("SELLER", details);
        toast.success("Your seller request was submitted successfully for approval!");
      }
      setEditingRequestId(null);
      setBecomeSellerOpen(false);
      fetchMyRoleRequests();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to submit request.");
    } finally {
      setSubmittingRole(false);
    }
  };

  const handleBecomeDeliverySubmit = async (e) => {
    e.preventDefault();
    const aadharClean = deliveryForm.aadharNumber.replace(/\s/g, "");
    const isBicycle = deliveryForm.vehicleType === "bicycle";
    const isElectricBike = deliveryForm.vehicleType === "electric_bike";
    const isVnRequired = !isBicycle;
    const isDlRequired = !isBicycle && !isElectricBike;

    if (!deliveryForm.name || !deliveryForm.address || !deliveryForm.city || !deliveryForm.state || 
        (isVnRequired && !deliveryForm.vehicleNumber) || 
        (isDlRequired && !deliveryForm.drivingLicenseNumber) || 
        !deliveryForm.panNumber || !aadharClean) {
      toast.error("Please fill in all required fields.");
      return;
    }
    if (aadharClean.length !== 12) {
      toast.error("Aadhaar Number must be exactly 12 digits.");
      return;
    }
    
    setSubmittingRole(true);
    try {
      const details = {
        name: deliveryForm.name,
        email: deliveryForm.email,
        address: deliveryForm.address,
        city: deliveryForm.city,
        state: deliveryForm.state,
        vehicleType: deliveryForm.vehicleType,
        vehicleName: deliveryForm.vehicleName,
        vehicleNumber: deliveryForm.vehicleNumber,
        drivingLicenseNumber: deliveryForm.drivingLicenseNumber,
        panNumber: deliveryForm.panNumber,
        aadharNumber: aadharClean,
      };
      
      if (editingRequestId) {
        await userAPI.updateRoleRequest(editingRequestId, details);
        toast.success("Your delivery partner request was updated successfully!");
      } else {
        await userAPI.submitRoleRequest("DELIVERY_BOY", details);
        toast.success("Your delivery partner request was submitted successfully for approval!");
      }
      setEditingRequestId(null);
      setBecomeDeliveryOpen(false);
      fetchMyRoleRequests();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to submit request.");
    } finally {
      setSubmittingRole(false);
    }
  };
  const isQuickProfile =
    routerLocation.pathname.startsWith("/quick") ||
    (isSharedProfile && profileSource === "quick");
  const sharedSourceQuery = profileSource ? `?from=${profileSource}` : "";
  const backPath = isQuickProfile ? "/quick" : "/food/user";
  const walletPath = isQuickProfile
    ? "/quick/wallet"
    : "/food/user/wallet";
  const couponPath = isSharedProfile
    ? `/profile/coupons${sharedSourceQuery}`
    : isQuickProfile
      ? "/quick/offers"
      : "/user/profile/coupons";
  const cartPath = isQuickProfile ? "/quick/cart" : "/cart";
  const showCartLink = true;
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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [referralReward, setReferralReward] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);

  // Trigger web push registration when profile mounts to ensure FCM token is saved
  useEffect(() => {
    registerWebPushForCurrentModule().catch(console.error);
  }, []);

  const handleVegModeUpdate = (nextValue) => {
    setVegMode(nextValue);
  };

  // Settings states
  const [appearance, setAppearance] = useState(() => theme || localStorage.getItem("appTheme") || "light");

  useEffect(() => {
    const normalizedTheme = theme === "dark" ? "dark" : "light";
    setAppearance(normalizedTheme);
  }, [theme]);

  useEffect(() => {
    const normalizedAppearance = appearance === "dark" ? "dark" : "light";
    setTheme(normalizedAppearance);
    localStorage.setItem("appTheme", normalizedAppearance);
    window.dispatchEvent(new CustomEvent("app-theme-changed", { detail: { theme: normalizedAppearance } }));
  }, [appearance, setTheme]);

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
                  const t = await Promise.race([
                    window.flutter_inappwebview.callHandler(handlerName, { module: "user" }),
                    new Promise((resolve) => setTimeout(() => resolve(null), 800))
                  ]);
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
      USER_SESSION_PREFERENCE_KEYS.forEach((key) => localStorage.removeItem(key));
      window.dispatchEvent(new Event("userAuthChanged"));

      // Still return to the shared login screen.
      navigate("/user/auth/login", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (isDeleting) return;
    setIsDeleting(true);

    try {
      // Call soft delete API on backend
      await userAPI.deleteAccount();
      
      // Cleanup locally
      clearModuleAuth("user");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user_authenticated");
      localStorage.removeItem("user_user");
      localStorage.removeItem("user");
      USER_SESSION_PREFERENCE_KEYS.forEach((key) => localStorage.removeItem(key));
      window.dispatchEvent(new Event("userAuthChanged"));

      toast.success("Account deleted successfully");

      // Redirect to login page
      navigate("/user/auth/login", { replace: true });
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error(error?.response?.data?.message || "Failed to delete account. Please try again.");
    } finally {
      setIsDeleting(false);
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
    <AnimatedPage className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a]">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-4 sm:py-6 md:py-8 lg:py-10 pb-20 sm:pb-24">
        {/* Header: Back Arrow */}
        <div className="flex items-center mb-4">
          <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={() => navigate(backPath)}>
            <ArrowLeft className="h-5 w-5 text-black dark:text-white" />
          </Button>
        </div>

        {/* Profile Info Card */}
        <Card className="bg-white dark:bg-[#1a1a1a] rounded-2xl py-0 pt-1 shadow-sm mb-0 border-0 dark:border-gray-800 overflow-hidden">
          <CardContent className="p-4 py-0 pt-2">
            <div className="flex items-start gap-4 mb-4">
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
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
                <h2 className="text-xl font-bold text-black dark:text-white mb-1">
                  {displayName}
                </h2>
                {hasValidEmail && (
                  <p className="text-sm text-black dark:text-gray-300 mb-1">
                    {userProfile.email}
                  </p>
                )}
                {userProfile?.phone && (
                  <p
                    className={`text-sm ${hasValidEmail ? "text-gray-600 dark:text-gray-400" : "text-black dark:text-white"} mb-3`}>
                    {userProfile.phone}
                  </p>
                )}
                {!hasValidEmail && !userProfile?.phone && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                    Not available
                  </p>
                )}
                {/* <Link to="/user/profile/activity" className="flex items-center gap-1 text-green-600 text-sm font-medium">
                  View activity
                  <ChevronRight className="h-4 w-4" />
                </Link> */}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Options */}
        <div className="space-y-2 mb-3 mt-3">
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

          {showCartLink && (
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
          )}

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
              <CardContent className="p-4  flex items-center justify-between">
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

          <motion.div
            whileHover={{ x: 4, scale: 1.01 }}
            transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
            <Card
              className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer"
              onClick={() => setAppearanceOpen(true)}>
              <CardContent className="p-4  flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div
                    className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
                    whileHover={{ rotate: 15, scale: 1.1 }}
                    transition={{ duration: 0.3 }}>
                    <Palette className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                  </motion.div>
                  <span className="text-base font-medium text-gray-900 dark:text-white">
                    Appearance
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <motion.span
                    className="text-base font-medium text-gray-900 dark:text-white capitalize"
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.2 }}>
                    {appearance}
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
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-1 h-4 bg-[#FE5502] rounded"></div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Food
            </h3>
          </div>
          <div className="space-y-2">
            <Link to="/user/profile/favorites" className="block">
              <motion.div
                whileHover={{ x: 4, scale: 1.01 }}
                transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
                <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                  <CardContent className="p-4  flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <motion.div
                        className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
                        whileHover={{ rotate: 15, scale: 1.1 }}
                        transition={{ duration: 0.3 }}>
                        <Bookmark className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                      </motion.div>
                      <span className="text-base font-medium text-gray-900 dark:text-white">
                        Saved items
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
        {quickCommerceEnabled && (
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
        )}

        {/* More Section */}
        <div className="mb-8 pb-8">
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-1 h-4 bg-[#FE5502] rounded"></div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              More
            </h3>
          </div>
          <div className="space-y-2">
            {quickCommerceEnabled && (
            <motion.div
              onClick={() => handleBecomeRoleClick("SELLER", () => setBecomeSellerOpen(true))}
              whileHover={{ x: 4, scale: 1.01 }}
              transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
              <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      transition={{ duration: 0.3 }}>
                      <Store className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    </motion.div>
                    <span className="text-base font-medium text-gray-900 dark:text-white">
                      Become as a Seller
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
            )}

            <motion.div
              onClick={() => handleBecomeRoleClick("DELIVERY_BOY", () => setBecomeDeliveryOpen(true))}
              whileHover={{ x: 4, scale: 1.01 }}
              transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
              <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      transition={{ duration: 0.3 }}>
                      <Truck className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    </motion.div>
                    <span className="text-base font-medium text-gray-900 dark:text-white">
                      Become as a Delivery Boy
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
              onClick={() => handleBecomeRoleClick("RESTAURANT", () => setBecomeRestaurantOpen(true))}
              whileHover={{ x: 4, scale: 1.01 }}
              transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
              <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      transition={{ duration: 0.3 }}>
                      <ChefHat className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    </motion.div>
                    <span className="text-base font-medium text-gray-900 dark:text-white">
                      Become as a Restaurant
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

            {userProfile?.role !== "ADMIN" && (
              <motion.div
                whileHover={{ x: 4, scale: 1.01 }}
                transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
                <Card
                  className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => setDeleteConfirmOpen(true)}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <motion.div
                        className="bg-rose-50 dark:bg-rose-950/30 rounded-full p-2"
                        whileHover={{ rotate: 15, scale: 1.1 }}
                        transition={{ duration: 0.3 }}>
                        <AlertTriangle
                          className={`h-5 w-5 text-rose-600 dark:text-rose-400 ${isDeleting ? "animate-pulse" : ""}`}
                        />
                      </motion.div>
                      <span className="text-base font-medium text-rose-600 dark:text-rose-400">
                        {isDeleting ? "Deleting account..." : "Delete Account"}
                      </span>
                    </div>
                    <motion.div
                      whileHover={{ x: 4 }}
                      transition={{ duration: 0.2 }}>
                      <ChevronRight className="h-5 w-5 text-rose-400 dark:text-rose-500" />
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </div>

        {/* Social Links Section */}
        {(socialLinks.facebook || socialLinks.instagram || socialLinks.twitter || socialLinks.linkedin || socialLinks.youtube) && (
          <div className="mb-8 pb-8 flex justify-center items-center gap-6">
            {socialLinks.facebook && (
              <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-500 transition-colors">
                <Facebook className="h-6 w-6" />
              </a>
            )}
            {socialLinks.instagram && (
              <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-pink-600 dark:text-gray-400 dark:hover:text-pink-500 transition-colors">
                <Instagram className="h-6 w-6" />
              </a>
            )}
            {socialLinks.twitter && (
              <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-blue-400 dark:text-gray-400 dark:hover:text-blue-300 transition-colors">
                <Twitter className="h-6 w-6" />
              </a>
            )}
            {socialLinks.linkedin && (
              <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-blue-700 dark:text-gray-400 dark:hover:text-blue-600 transition-colors">
                <Linkedin className="h-6 w-6" />
              </a>
            )}
            {socialLinks.youtube && (
              <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-500 transition-colors">
                <Youtube className="h-6 w-6" />
              </a>
            )}
          </div>
        )}
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
                handleVegModeUpdate(true);
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

      {/* Role Request Status Modal */}
      <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <DialogContent className="max-w-sm md:max-w-md w-[calc(100%-2rem)] rounded-2xl p-0 overflow-hidden bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-gray-800">
          <DialogHeader className="p-5 pb-3">
            <DialogTitle className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary-orange animate-pulse" />
              Request Submitted
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
              You have already submitted an onboarding request.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-5 pb-5">
            {selectedStatusRequest && (
              <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Role</span>
                  <span className="text-sm font-semibold text-gray-850 dark:text-gray-200">
                    {selectedStatusRequest.role === "RESTAURANT" && "Restaurant"}
                    {selectedStatusRequest.role === "SELLER" && "Seller"}
                    {selectedStatusRequest.role === "DELIVERY_BOY" && "Delivery Partner"}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Status</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    selectedStatusRequest.status === "PENDING" ? "bg-amber-100 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30" : ""
                  } ${
                    selectedStatusRequest.status === "APPROVED" ? "bg-emerald-100 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30" : ""
                  } ${
                    selectedStatusRequest.status === "REJECTED" ? "bg-rose-100 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30" : ""
                  }`}>
                    {selectedStatusRequest.status === "PENDING" && "Pending"}
                    {selectedStatusRequest.status === "APPROVED" && "Approved"}
                    {selectedStatusRequest.status === "REJECTED" && "Rejected"}
                  </span>
                </div>

                {selectedStatusRequest.status === "PENDING" && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    Your request is under review by our administration. You can edit the details or delete the request.
                  </p>
                )}
                {selectedStatusRequest.status === "APPROVED" && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    Congratulations! Your onboarding request has been approved and activated.
                  </p>
                )}
                {selectedStatusRequest.status === "REJECTED" && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                    Your request was rejected. You can delete this request to submit a new onboard application.
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              {selectedStatusRequest?.status === "PENDING" && (
                <Button
                  onClick={() => handleEditRequest(selectedStatusRequest)}
                  className="w-full rounded-xl bg-primary-orange hover:bg-primary-orange/95 text-white font-semibold"
                >
                  Edit Request
                </Button>
              )}
              
              {["PENDING", "REJECTED"].includes(selectedStatusRequest?.status) && (
                <Button
                  onClick={() => handleDeleteRequest(selectedStatusRequest)}
                  variant="outline"
                  className="w-full rounded-xl border-rose-200 dark:border-rose-950 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-700 font-semibold"
                >
                  Delete Request
                </Button>
              )}

              <Button
                onClick={() => setStatusModalOpen(false)}
                variant="outline"
                className="w-full rounded-xl border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 font-semibold"
              >
                Close
              </Button>
            </div>
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
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1a1a1a] p-5 shadow-2xl border border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Delete Account?
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to delete your account? This action is irreversible. All your profile settings, transactions, and balance will be disabled.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={isDeleting}
              >
                No, Keep it
              </Button>
              <Button
                type="button"
                className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  handleDeleteAccount();
                }}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Yes, Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Appearance Popup */}
      <Dialog open={appearanceOpen} onOpenChange={setAppearanceOpen}>
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
                  ? "border-blue-600 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
                }`}>
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${appearance === "light"
                    ? "border-blue-600 bg-blue-600 dark:border-blue-500 dark:bg-blue-500"
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
                  ? "border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
                }`}>
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${appearance === "dark"
                    ? "border-blue-600 bg-blue-600 dark:border-blue-500 dark:bg-blue-500"
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
      </Dialog>

      {/* Become as a Restaurant Dialog */}
      <Dialog open={becomeRestaurantOpen} onOpenChange={setBecomeRestaurantOpen}>
        <DialogContent className="max-w-md md:max-w-lg w-[calc(100%-2rem)] max-h-[85vh] overflow-y-auto rounded-2xl p-0 bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-gray-800">
          <DialogHeader className="p-5 pb-3 border-b border-gray-100 dark:border-zinc-800">
            <DialogTitle className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-primary-orange" />
              Become as a Restaurant
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500 dark:text-gray-400">
              Submit your basic details to register a restaurant
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleBecomeRestaurantSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Restaurant Name <span className="text-red-500">*</span></label>
              <input required type="text" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="Restaurant name" value={restaurantForm.restaurantName} onChange={e => setRestaurantForm({...restaurantForm, restaurantName: e.target.value})} />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Type <span className="text-red-500">*</span></label>
              <select className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" value={restaurantForm.pureVegRestaurant} onChange={e => setRestaurantForm({...restaurantForm, pureVegRestaurant: e.target.value})}>
                <option value="false">Non-Vegetarian & Vegetarian</option>
                <option value="true">Pure Vegetarian</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Owner Name <span className="text-red-500">*</span></label>
                <input required type="text" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="Owner name" value={restaurantForm.ownerName} onChange={e => setRestaurantForm({...restaurantForm, ownerName: e.target.value.replace(/[^a-zA-Z\s]/g, "")})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Owner Email <span className="text-red-500">*</span></label>
                <input required type="email" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="owner@email.com" value={restaurantForm.ownerEmail} onChange={e => setRestaurantForm({...restaurantForm, ownerEmail: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Owner Phone <span className="text-red-500">*</span></label>
                <input required type="text" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="Owner phone" value={restaurantForm.ownerPhone} onChange={e => setRestaurantForm({...restaurantForm, ownerPhone: e.target.value.replace(/\D/g, "").slice(0, 10)})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Primary Contact <span className="text-red-500">*</span></label>
                <input required type="text" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="Primary contact" value={restaurantForm.primaryContactNumber} onChange={e => setRestaurantForm({...restaurantForm, primaryContactNumber: e.target.value.replace(/\D/g, "").slice(0, 10)})} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Service Zone <span className="text-red-500">*</span></label>
              <select required className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" value={restaurantForm.zoneId} onChange={e => setRestaurantForm({...restaurantForm, zoneId: e.target.value})} disabled={loadingZones}>
                <option value="">{loadingZones ? "Loading zones..." : "Select Service Zone"}</option>
                {zones.map(z => (
                  <option key={z._id || z.id} value={z._id || z.id}>
                    {z.name || z.zoneName || z.serviceLocation || "Zone"}
                  </option>
                ))}
              </select>
            </div>

            <div className="border-t border-dashed border-gray-200 dark:border-zinc-800 pt-3">
              <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider block mb-2">Location Details</span>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Address Line 1 <span className="text-red-500">*</span></label>
                  <input required type="text" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="Flat, House no., Building, Company" value={restaurantForm.addressLine1} onChange={e => setRestaurantForm({...restaurantForm, addressLine1: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Address Line 2 (Optional)</label>
                  <input type="text" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="Area, Street, Sector, Village" value={restaurantForm.addressLine2} onChange={e => setRestaurantForm({...restaurantForm, addressLine2: e.target.value})} />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Area / Locality</label>
                    <input type="text" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="Area" value={restaurantForm.area} onChange={e => setRestaurantForm({...restaurantForm, area: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Landmark</label>
                    <input type="text" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="E.g. near hospital" value={restaurantForm.landmark} onChange={e => setRestaurantForm({...restaurantForm, landmark: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">City <span className="text-red-500">*</span></label>
                    <input required type="text" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="City" value={restaurantForm.city} onChange={e => setRestaurantForm({...restaurantForm, city: e.target.value.replace(/[^a-zA-Z\s]/g, "")})} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">State <span className="text-red-500">*</span></label>
                    <input required type="text" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="State" value={restaurantForm.state} onChange={e => setRestaurantForm({...restaurantForm, state: e.target.value.replace(/[^a-zA-Z\s]/g, "")})} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Pincode <span className="text-red-500">*</span></label>
                    <input required type="text" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="6 digits" value={restaurantForm.pincode} onChange={e => setRestaurantForm({...restaurantForm, pincode: e.target.value.replace(/\D/g, "").slice(0, 6)})} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3">
              <Button type="button" variant="outline" className="flex-1 rounded-xl text-sm" onClick={() => setBecomeRestaurantOpen(false)} disabled={submittingRole}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1 rounded-xl text-sm bg-primary-orange hover:bg-primary-orange/95 text-white" disabled={submittingRole}>
                {submittingRole ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Request"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Become as a Seller Dialog */}
      <Dialog open={becomeSellerOpen} onOpenChange={setBecomeSellerOpen}>
        <DialogContent className="max-w-md md:max-w-lg w-[calc(100%-2rem)] max-h-[85vh] overflow-y-auto rounded-2xl p-0 bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-gray-800">
          <DialogHeader className="p-5 pb-3 border-b border-gray-100 dark:border-zinc-800">
            <DialogTitle className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Store className="h-5 w-5 text-primary-orange" />
              Become as a Seller
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500 dark:text-gray-400">
              Submit your basic store details to onboard as a merchant
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleBecomeSellerSubmit} className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Seller Name <span className="text-red-500">*</span></label>
                <input required type="text" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="Your name" value={sellerForm.name} onChange={e => setSellerForm({...sellerForm, name: e.target.value.replace(/[^a-zA-Z\s]/g, "")})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Shop Name <span className="text-red-500">*</span></label>
                <input required type="text" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="Shop name" value={sellerForm.shopName} onChange={e => setSellerForm({...sellerForm, shopName: e.target.value.replace(/[^a-zA-Z\s]/g, "")})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Email <span className="text-red-500">*</span></label>
                <input required type="email" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="seller@email.com" value={sellerForm.email} onChange={e => setSellerForm({...sellerForm, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Primary Phone <span className="text-red-500">*</span></label>
                <input required type="text" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="Primary phone" value={sellerForm.phone} onChange={e => setSellerForm({...sellerForm, phone: e.target.value.replace(/\D/g, "").slice(0, 10)})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Business Type <span className="text-red-500">*</span></label>
                <select className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" value={sellerForm.businessType} onChange={e => setSellerForm({...sellerForm, businessType: e.target.value})}>
                  <option value="Grocery">Grocery</option>
                  <option value="Bakery">Bakery</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Fashion">Fashion</option>
                  <option value="General Store">General Store</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Alternate Phone <span className="text-red-500">*</span></label>
                <input required type="text" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="Alternate phone" value={sellerForm.alternatePhone} onChange={e => setSellerForm({...sellerForm, alternatePhone: e.target.value.replace(/\D/g, "").slice(0, 10)})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Service Zone <span className="text-red-500">*</span></label>
                <select required className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" value={sellerForm.zoneId} onChange={e => setSellerForm({...sellerForm, zoneId: e.target.value})} disabled={loadingZones}>
                  <option value="">{loadingZones ? "Loading zones..." : "Select Service Zone"}</option>
                  {zones.map(z => (
                    <option key={z._id || z.id} value={z._id || z.id}>
                      {z.name || z.zoneName || z.serviceLocation || "Zone"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Support Email <span className="text-red-500">*</span></label>
                <input required type="email" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="support@email.com" value={sellerForm.supportEmail} onChange={e => setSellerForm({...sellerForm, supportEmail: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Opening Time <span className="text-red-500">*</span></label>
                <input required type="time" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" value={sellerForm.openingTime} onChange={e => setSellerForm({...sellerForm, openingTime: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Closing Time <span className="text-red-500">*</span></label>
                <input required type="time" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" value={sellerForm.closingTime} onChange={e => setSellerForm({...sellerForm, closingTime: e.target.value})} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Shop Address <span className="text-red-500">*</span></label>
              <textarea required rows={2} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="Complete shop address" value={sellerForm.address} onChange={e => setSellerForm({...sellerForm, address: e.target.value})} />
            </div>

            <div className="flex items-center gap-3 pt-3">
              <Button type="button" variant="outline" className="flex-1 rounded-xl text-sm" onClick={() => setBecomeSellerOpen(false)} disabled={submittingRole}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1 rounded-xl text-sm bg-primary-orange hover:bg-primary-orange/95 text-white" disabled={submittingRole}>
                {submittingRole ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Request"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Become as a Delivery Boy Dialog */}
      <Dialog open={becomeDeliveryOpen} onOpenChange={setBecomeDeliveryOpen}>
        <DialogContent className="max-w-md md:max-w-lg w-[calc(100%-2rem)] max-h-[85vh] overflow-y-auto rounded-2xl p-0 bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-gray-800">
          <DialogHeader className="p-5 pb-3 border-b border-gray-100 dark:border-zinc-800">
            <DialogTitle className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary-orange" />
              Become as a Delivery Boy
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500 dark:text-gray-400">
              Submit your details to onboard as a delivery partner
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleBecomeDeliverySubmit} className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Full Name <span className="text-red-500">*</span></label>
                <input required type="text" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="Your full name" value={deliveryForm.name} onChange={e => setDeliveryForm({...deliveryForm, name: e.target.value.replace(/[^a-zA-Z\s]/g, "")})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Email <span className="text-red-500">*</span></label>
                <input required type="email" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="delivery@email.com" value={deliveryForm.email} onChange={e => setDeliveryForm({...deliveryForm, email: e.target.value})} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Address <span className="text-red-500">*</span></label>
              <textarea required rows={2} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="Complete home address" value={deliveryForm.address} onChange={e => setDeliveryForm({...deliveryForm, address: e.target.value})} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">City <span className="text-red-500">*</span></label>
                <input required type="text" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="City" value={deliveryForm.city} onChange={e => setDeliveryForm({...deliveryForm, city: e.target.value.replace(/[^a-zA-Z\s]/g, "")})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">State <span className="text-red-500">*</span></label>
                <input required type="text" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="State" value={deliveryForm.state} onChange={e => setDeliveryForm({...deliveryForm, state: e.target.value.replace(/[^a-zA-Z\s]/g, "")})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Vehicle Type <span className="text-red-500">*</span></label>
                <select className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" value={deliveryForm.vehicleType} onChange={e => setDeliveryForm({...deliveryForm, vehicleType: e.target.value})}>
                  <option value="bike">Bike</option>
                  <option value="scooter">Scooter</option>
                  <option value="bicycle">Bicycle</option>
                  <option value="electric_bike">Electric Bike</option>
                  <option value="car">Car</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Vehicle Name/Model</label>
                <input type="text" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="E.g. Splendor, Activa" value={deliveryForm.vehicleName} onChange={e => setDeliveryForm({...deliveryForm, vehicleName: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Vehicle Number {deliveryForm.vehicleType !== "bicycle" && <span className="text-red-500">*</span>}</label>
                <input required={deliveryForm.vehicleType !== "bicycle"} type="text" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="E.g. MH12AB1234" value={deliveryForm.vehicleNumber} onChange={e => setDeliveryForm({...deliveryForm, vehicleNumber: e.target.value.toUpperCase()})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Driving License No {deliveryForm.vehicleType !== "bicycle" && deliveryForm.vehicleType !== "electric_bike" && <span className="text-red-500">*</span>}</label>
                <input required={deliveryForm.vehicleType !== "bicycle" && deliveryForm.vehicleType !== "electric_bike"} type="text" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="E.g. MH1220110012345" value={deliveryForm.drivingLicenseNumber} onChange={e => setDeliveryForm({...deliveryForm, drivingLicenseNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">PAN Number <span className="text-red-500">*</span></label>
                <input required type="text" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="ABCDE1234F" value={deliveryForm.panNumber} onChange={e => setDeliveryForm({...deliveryForm, panNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Aadhaar Number <span className="text-red-500">*</span></label>
                <input required type="text" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-950 dark:text-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-orange focus:border-primary-orange transition-all" placeholder="12 digits" value={deliveryForm.aadharNumber} onChange={e => setDeliveryForm({...deliveryForm, aadharNumber: e.target.value.replace(/\D/g, "").slice(0, 12).replace(/(\d{4})(?=\d)/g, "$1 ")})} />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3">
              <Button type="button" variant="outline" className="flex-1 rounded-xl text-sm" onClick={() => setBecomeDeliveryOpen(false)} disabled={submittingRole}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1 rounded-xl text-sm bg-primary-orange hover:bg-primary-orange/95 text-white" disabled={submittingRole}>
                {submittingRole ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Request"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  );
}
