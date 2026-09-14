// @FeedNavbar.jsx
import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { HelpCircle, ArrowRight, Phone, Ambulance, AlertTriangle, Shield, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { deliveryAPI } from "@food/api";
import {
  getCachedSettings,
  subscribeBusinessSettings,
  getCompanyName,
  getAppLogo,
  getAppFavicon,
  updateFavicon,
} from "@common/utils/businessSettings";
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


const LS_KEY = "app:isOnline";
const TOAST_ID_KEY = "feedNavbar-onlineStatus";

/** Minimal bottom-sheet popup (self-contained) */
function BottomPopup({
  isOpen,
  onClose,
  title,
  children,
  showCloseButton = true,
  closeOnBackdropClick = true,
  maxHeight = "70vh",
}) {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end"
      onClick={closeOnBackdropClick ? onClose : undefined}
    >
      <div className="absolute inset-0 bg-black/40" />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative w-full bg-white rounded-t-2xl shadow-xl p-4"
        style={{ maxHeight, overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-sm px-3 py-1 rounded-md"
            >
              Close
            </button>
          )}
        </div>
        {children}
      </motion.div>
    </div>
  );
}

export default function FeedNavbar({ className = "" }) {
  const [logoUrl, setLogoUrl] = useState(() => getAppLogo('delivery'))
  const [companyName, setCompanyName] = useState(() => getCompanyName())
  const navigate = useNavigate();

  // Apply branding from cache; subscribe if not yet available
  useEffect(() => {
    const applyBranding = (settings) => {
      const deliveryLogo = getAppLogo('delivery') || settings?.deliveryLogo?.url || settings?.logo?.url
      if (deliveryLogo) setLogoUrl(deliveryLogo)
      const deliveryFav = getAppFavicon('delivery') || settings?.deliveryFavicon?.url || settings?.favicon?.url
      if (deliveryFav) updateFavicon(deliveryFav)
      const name = settings?.companyName || getCompanyName()
      if (name) setCompanyName(name)
    }

    if (getCachedSettings()) {
      applyBranding()
    }

    return subscribeBusinessSettings((settings) => applyBranding(settings))
  }, [])

  const normalizePhoneForDial = (value) => String(value || "").replace(/[^\d]/g, "");

  // 1) Init from localStorage (no toast on mount)
  const [isOnline, setIsOnline] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) === true : false;
    } catch {
      return false;
    }
  });

  // 2) Persist to localStorage whenever it changes and notify other components
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(isOnline));
      // Dispatch custom event for same-tab sync (storage event only works across tabs)
      window.dispatchEvent(new CustomEvent('onlineStatusChanged'));
    } catch {}
  }, [isOnline]);

  // 3) Optional: sync across tabs/windows
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === LS_KEY && e.newValue != null) {
        const next = JSON.parse(e.newValue) === true;
        setIsOnline((prev) => (prev === next ? prev : next));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // prevent duplicate toasts using a global toast ID
  const showSingleToast = (isNowOnline) => {
    // Dismiss any existing toast with the same ID first
    toast.dismiss(TOAST_ID_KEY);
    
    // Show new toast with a consistent ID to prevent duplicates and offset position
    if (isNowOnline) {
      toast.success("You are now online", { 
        id: TOAST_ID_KEY,
        style: { marginTop: '80px' }
      });
    } else {
      toast("You are now offline", { 
        id: TOAST_ID_KEY,
        style: { marginTop: '80px' }
      });
    }
  };

  const handleProfileClick = () => navigate("/delivery/profile");

  const handleToggle = async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    const next = !isOnline;
    
    // Update state immediately for better UX
    setIsOnline(next);
    showSingleToast(next);

    // Update backend with location if available
    try {
      // Try to get current location from localStorage or geolocation
      let latitude = null;
      let longitude = null;
      
      // Check localStorage first
      try {
        const savedLocation = localStorage.getItem('deliveryBoyLastLocation');
        if (savedLocation) {
          const location = JSON.parse(savedLocation);
          if (Array.isArray(location) && location.length === 2) {
            let [lat, lng] = location;
            
            // Validate and check for coordinate swap
            if (typeof lat === 'number' && typeof lng === 'number' &&
                lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
              // Check if coordinates might be swapped (lat in lng range for India)
              const mightBeSwapped = (lat >= 68 && lat <= 98 && lng >= 8 && lng <= 38);
              
              if (mightBeSwapped) {
                debugWarn('?? Saved coordinates might be swapped in FeedNavbar - correcting:', {
                  original: [lat, lng],
                  corrected: [lng, lat]
                });
                [latitude, longitude] = [lng, lat];
              } else {
                [latitude, longitude] = [lat, lng];
              }
            }
          }
        }
      } catch (err) {
        debugWarn('Error reading location from localStorage:', err);
      }
      
      // If no saved location, try to get current location
      if ((!latitude || !longitude) && navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
              maximumAge: 0,
              enableHighAccuracy: true
            });
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
          
          // Validate coordinates
          if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
              latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            debugWarn('?? Invalid coordinates from geolocation:', { latitude, longitude });
            latitude = null;
            longitude = null;
          }
        } catch (geoError) {
          debugWarn('Could not get current location:', geoError);
        }
      }
      
      // Update backend with location if available, otherwise just online status
      if (latitude && longitude && 
          latitude >= -90 && latitude <= 90 && 
          longitude >= -180 && longitude <= 180) {
        await deliveryAPI.updateLocation(latitude, longitude, next);
        debugLog('? Online status and location updated in backend:', { 
          isOnline: next, 
          latitude, 
          longitude,
          format: "lat, lng (correct order)"
        });
      } else {
        await deliveryAPI.updateOnlineStatus(next);
        debugLog('? Online status updated in backend (location not available):', next);
      }
    } catch (error) {
      debugError('? Error updating online status in backend:', error);
      // Revert state if backend update fails
      setIsOnline(!next);
      toast.error('Failed to update status. Please try again.');
    }
  };

  // Help options with proper navigation paths
  const helpOptions = [
    { 
      id: "supportTickets", 
      title: "Support tickets", 
      subtitle: "Check status of tickets raised", 
      icon: "ticket", 
      path: "/delivery/help/tickets"
    },
    { 
      id: "idCard", 
      title: "Show ID card", 
      subtitle: `See your ${companyName} ID card`, 
      icon: "idCard", 
      path: "/delivery/help/id-card"
    },
  ];

  // Handle help option click - navigate to the correct route
  const handleHelpOptionClick = (option) => {
    if (option.path) {
      setShowHelpPopup(false);
      navigate(option.path);
    } else if (option.onClick) {
      option.onClick();
      setShowHelpPopup(false);
    }
  };

  const [emergencyNumbers, setEmergencyNumbers] = useState({
    medicalEmergency: "",
    accidentHelpline: "",
    contactPolice: "",
    insurance: "",
  });

  const [showEmergencyPopup, setShowEmergencyPopup] = useState(false);
  const [showHelpPopup, setShowHelpPopup] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [imageError, setImageError] = useState(false);

  // Fetch emergency help numbers once per mount (no refetch loop)
  const emergencyHelpFetched = useRef(false);
  useEffect(() => {
    if (emergencyHelpFetched.current) return;
    emergencyHelpFetched.current = true;
    let cancelled = false;
    (async () => {
      try {
        const response = await deliveryAPI.getEmergencyHelp();
        if (cancelled) return;
        if (response?.data?.success && response?.data?.data) {
          setEmergencyNumbers({
            medicalEmergency: response.data.data.medicalEmergency || "",
            accidentHelpline: response.data.data.accidentHelpline || "",
            contactPolice: response.data.data.contactPolice || "",
            insurance: response.data.data.insurance || "",
          });
        }
      } catch (error) {
        if (!cancelled) debugError("Error fetching emergency help:", error);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Emergency options with phone numbers from API
  const emergencyOptions = [
    { 
      id: "ambulance", 
      title: "Medical Emergency", 
      subtitle: "Call an ambulance", 
      icon: "ambulance", 
      phone: emergencyNumbers.medicalEmergency,
      onClick: () => {
        const phoneToDial = normalizePhoneForDial(emergencyNumbers.medicalEmergency);
        if (phoneToDial.length >= 3) {
          window.location.href = `tel:${phoneToDial}`;
        } else {
          toast.error("Medical emergency number not configured");
        }
      }
    },
    { 
      id: "accident", 
      title: "Accident Helpline", 
      subtitle: "Report an accident", 
      icon: "accident", 
      phone: emergencyNumbers.accidentHelpline,
      onClick: () => {
        const phoneToDial = normalizePhoneForDial(emergencyNumbers.accidentHelpline);
        if (phoneToDial.length >= 3) {
          window.location.href = `tel:${phoneToDial}`;
        } else {
          toast.error("Accident helpline number not configured");
        }
      }
    },
    { 
      id: "police", 
      title: "Contact Police", 
      subtitle: "Nearest police support", 
      icon: "police", 
      phone: emergencyNumbers.contactPolice,
      onClick: () => {
        const phoneToDial = normalizePhoneForDial(emergencyNumbers.contactPolice);
        if (phoneToDial.length >= 3) {
          window.location.href = `tel:${phoneToDial}`;
        } else {
          toast.error("Police emergency number not configured");
        }
      }
    },
    { 
      id: "insurance", 
      title: "Insurance", 
      subtitle: "Policy & claim help", 
      icon: "insurance", 
      phone: emergencyNumbers.insurance,
      onClick: () => {
        const phoneToDial = normalizePhoneForDial(emergencyNumbers.insurance);
        if (phoneToDial.length >= 3) {
          window.location.href = `tel:${phoneToDial}`;
        } else {
          toast.error("Insurance helpline number not configured");
        }
      }
    },
  ];

  // Fetch profile image
  useEffect(() => {
    const fetchProfileImage = async () => {
      try {
        const response = await deliveryAPI.getProfile();
        if (response?.data?.success && response?.data?.data?.profile) {
          const profile = response.data.data.profile;
          // Use profileImage.url first, fallback to documents.photo
          const imageUrl = profile.profileImage?.url || profile.documents?.photo;
          if (imageUrl) {
            setProfileImage(imageUrl);
            setImageError(false);
          }
        }
      } catch (error) {
        // Skip logging network and timeout errors (handled by axios interceptor)
        if (error.code !== 'ECONNABORTED' && 
            error.code !== 'ERR_NETWORK' && 
            error.message !== 'Network Error' &&
            !error.message?.includes('timeout')) {
          debugError("Error fetching profile image for navbar:", error);
        }
      }
    };

    fetchProfileImage();

    // Listen for profile refresh events
    const handleProfileRefresh = () => {
      fetchProfileImage();
    };

    window.addEventListener('deliveryProfileRefresh', handleProfileRefresh);
    
    return () => {
      window.removeEventListener('deliveryProfileRefresh', handleProfileRefresh);
    };
  }, []);

  return (
    <>
    <div className={`app-shell-page__header safe-top bg-white px-4 py-3 flex items-center justify-between border-b border-gray-200 ${className}`}>
        {/* Logo and Online/Offline Toggle */}
      <div className="flex items-center gap-3">
        {logoUrl && (
          <img src={logoUrl} alt="Logo" className="h-8 w-auto object-contain" />
        )}
        <div className="relative" style={{ zIndex: 100 }}>
          <button
            onClick={handleToggle}
            onTouchStart={(e) => e.stopPropagation()}
            className="focus:outline-none relative cursor-pointer"
            type="button"
            role="switch"
              aria-checked={isOnline}
              style={{ pointerEvents: "auto", zIndex: 100, WebkitTapHighlightColor: "transparent" }}
            >
              <div className={`relative w-20 h-8 rounded-full transition-colors duration-300 ${isOnline ? "bg-green-500" : "bg-gray-400"}`}>
              <span
                className={`text-[11px] font-bold text-white absolute top-1/2 -translate-y-1/2 whitespace-nowrap transition-all duration-300 ${
                    isOnline ? "left-2" : "right-2"
                }`}
                style={{ opacity: 1, zIndex: 2, pointerEvents: "none" }}
              >
                  {isOnline ? "Online" : "Offline"}
              </span>

              <motion.div
                className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg"
                  animate={{ x: isOnline ? 48 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                style={{ pointerEvents: "none", zIndex: 10 }}
              />
            </div>
          </button>
        </div>
      </div>

      {/* Right Icons */}
      <div className="flex items-center gap-3">
        {/* Emergency */}
        <button
            onClick={() => setShowEmergencyPopup(true)}
          className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center hover:bg-red-600 transition-colors relative"
            title="Emergency"
        >
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </button>

        {/* Help */}
        <button
            onClick={() => setShowHelpPopup(true)}
          className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
            title="Help"
        >
          <HelpCircle className="w-5 h-5 text-gray-700" />
        </button>

        {/* Profile */}
        <button onClick={handleProfileClick} className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-gray-300 flex items-center justify-center bg-gray-200" title="Profile">
          {profileImage && !imageError ? (
            <img
              src={profileImage}
              alt="Profile"
              className="w-full h-full object-cover"
              onError={() => {
                setImageError(true);
              }}
            />
          ) : (
            <User className="w-5 h-5 text-gray-500" />
          )}
        </button>
      </div>
    </div>

      {/* Help Popup */}
      <BottomPopup
        isOpen={showHelpPopup}
        onClose={() => setShowHelpPopup(false)}
        title="How can we help?"
        showCloseButton={true}
        closeOnBackdropClick={true}
        maxHeight="70vh"
      >
    <div className="py-2">
          {helpOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => handleHelpOptionClick(option)}
              className="w-full flex items-center gap-4 py-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
            >
              {/* Icon */}
              <div className="shrink-0 w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                {option.icon === "helpCenter" && (
                  <HelpCircle className="w-6 h-6 text-gray-700" />
                )}
                {option.icon === "ticket" && (
                  <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                )}
                {option.icon === "idCard" && (
                  <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                  </svg>
                )}
                {option.icon === "language" && (
                  <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                  </svg>
                )}
              </div>

              {/* Text Content */}
              <div className="flex-1 text-left">
                <h3 className="text-base font-semibold text-gray-900 mb-1">{option.title}</h3>
                <p className="text-sm text-gray-600">{option.subtitle}</p>
              </div>

              {/* Arrow Icon */}
              <ArrowRight className="w-5 h-5 text-gray-400 shrink-0" />
            </button>
          ))}
        </div>
      </BottomPopup>

      {/* Emergency Popup */}
      <BottomPopup
        isOpen={showEmergencyPopup}
        onClose={() => setShowEmergencyPopup(false)}
        title="Emergency help"
        showCloseButton={true}
        closeOnBackdropClick={true}
        maxHeight="70vh"
      >
        <div className="py-2">
          {emergencyOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => {
                option.onClick?.();
                setShowEmergencyPopup(false);
              }}
              className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
            >
              <div className="shrink-0 w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                {option.icon === "ambulance" && (
                  <Ambulance className="w-6 h-6 text-red-600" />
                )}
                {option.icon === "accident" && (
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                )}
                {option.icon === "police" && (
                  <Shield className="w-6 h-6 text-blue-600" />
                )}
                {option.icon === "insurance" && (
                  <ShieldCheck className="w-6 h-6 text-green-600" />
                )}
              </div>

              <div className="flex-1 text-left">
                <h3 className="text-base font-semibold text-gray-900 mb-1">{option.title}</h3>
                <p className="text-sm text-gray-600">{option.subtitle}</p>
              </div>

              <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
            </button>
          ))}
        </div>
      </BottomPopup>
    </>
  );
}

