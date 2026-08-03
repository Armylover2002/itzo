import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { useProximityCheck } from '@/modules/DeliveryV2/hooks/useProximityCheck';
import { useOrderManager } from '@/modules/DeliveryV2/hooks/useOrderManager';
import { useDeliveryNotifications } from '@food/hooks/useDeliveryNotifications';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';

// Components
import LiveMap from '@/modules/DeliveryV2/components/map/LiveMap';
import { NewOrderModal } from '@/modules/DeliveryV2/components/modals/NewOrderModal';
import { PickupActionModal } from '@/modules/DeliveryV2/components/modals/PickupActionModal';
import { DeliveryVerificationModal } from '@/modules/DeliveryV2/components/modals/DeliveryVerificationModal';
import { OrderSummaryModal } from '@/modules/DeliveryV2/components/modals/OrderSummaryModal';
import ActionSlider from '@/modules/DeliveryV2/components/ui/ActionSlider';

// Sub Pages
import PocketV2 from '@/modules/DeliveryV2/pages/PocketV2';
import HistoryV2 from '@/modules/DeliveryV2/pages/HistoryV2';
import ProfileV2 from '@/modules/DeliveryV2/pages/ProfileV2';

// Icons
import { 
  Bell, HelpCircle, AlertTriangle, 
  Wallet, History, User as UserIcon, LayoutGrid,
  Plus, Minus, Navigation2, Target, Play, CheckCircle2, Clock, ChevronDown,
  Contact, Package, ShieldCheck, Loader2, Zap, Phone, RotateCcw
} from 'lucide-react';
import { subscriptionAPI } from '@food/api';

import { getHaversineDistance, calculateETA, calculateHeading } from '@/modules/DeliveryV2/utils/geo';
import { getPrimaryPickupLocation, normalizePickupPoints } from '@/modules/DeliveryV2/utils/orderRouting';
import { useCompanyName } from "@food/hooks/useCompanyName";
import { useNavigate } from 'react-router-dom';
import useNotificationInbox from "@food/hooks/useNotificationInbox";
import { Button } from "@food/components/ui/button";

/** Minimal bottom-sheet popup (Restored from legacy FeedNavbar) */
function BottomPopup({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[600] flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative w-full bg-white rounded-t-3xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
             <AlertTriangle className="w-4 h-4" />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

const SubscriptionConfirmationModal = ({ isOpen, onClose, onConfirm, loading, data }) => {
  if (!isOpen) return null;
  const amount = data?.deductionAmount || 20;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative bg-white rounded-[40px] p-8 max-w-sm w-full text-center shadow-2xl overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-500 to-amber-400" />
        
        <div className="w-20 h-20 bg-orange-50 rounded-[32px] flex items-center justify-center mx-auto mb-6 text-orange-600 shadow-inner">
           <Zap className="w-10 h-10" />
        </div>
        
        <h3 className="text-2xl font-black text-slate-900 mb-2 leading-tight">Go Online &<br />Activate Pass?</h3>
        <p className="text-slate-500 text-sm mb-6 leading-relaxed">
          Going online will activate your One-Day Pass.
          <br /><br />
          <span className="font-black text-slate-900">₹{amount}</span> will be deducted from your Subscription Wallet.
        </p>

        <div className="bg-slate-50 rounded-3xl p-5 mb-8 text-left space-y-3 border border-slate-100">
           <div className="flex items-center gap-3 text-[11px] font-bold text-slate-600">
             <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white"><CheckCircle2 className="w-3 h-3" /></div>
             Receive delivery requests
           </div>
           <div className="flex items-center gap-3 text-[11px] font-bold text-slate-600">
             <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white"><CheckCircle2 className="w-3 h-3" /></div>
             Stay active for today
           </div>
           <div className="flex items-center gap-3 text-[11px] font-bold text-slate-600">
             <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white"><CheckCircle2 className="w-3 h-3" /></div>
             One-time deduction only
           </div>
        </div>
        
        <div className="space-y-3">
          <Button 
            onClick={onConfirm}
            disabled={loading}
            className="w-full h-15 bg-primary hover:bg-primary/90 text-primary-foreground rounded-[24px] font-black text-base shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <ShieldCheck className="w-6 h-6" />}
            Go Online
          </Button>
          <button 
            onClick={onClose}
            disabled={loading}
            className="w-full py-2 text-slate-400 font-bold text-xs uppercase tracking-[0.2em] hover:text-slate-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const LowBalanceBlockingModal = ({ isOpen, onClose, onRecharge, data }) => {
  if (!isOpen) return null;
  const balance = data?.balance || 0;
  const threshold = data?.threshold || 1000;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative bg-white rounded-[40px] p-8 max-w-sm w-full text-center shadow-2xl overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-rose-500" />
        
        <div className="w-20 h-20 bg-rose-50 rounded-[32px] flex items-center justify-center mx-auto mb-6 text-rose-600 shadow-inner">
           <AlertTriangle className="w-10 h-10" />
        </div>
        
        <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Low Subscription Balance</h3>
        <p className="text-slate-500 text-sm mb-8 leading-relaxed">
          You need minimum ₹{threshold} subscription balance to receive delivery orders.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Current</p>
            <p className="text-lg font-black text-rose-600">₹{balance.toFixed(0)}</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Required</p>
            <p className="text-lg font-black text-slate-900">₹{threshold}</p>
          </div>
        </div>
        
        <div className="space-y-3">
          <Button 
            onClick={onRecharge}
            className="w-full h-15 bg-primary hover:bg-primary/90 text-primary-foreground rounded-[24px] font-black text-base shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Wallet className="w-5 h-5" />
            Recharge Wallet
          </Button>
          <button 
            onClick={onClose}
            className="w-full py-2 text-slate-400 font-bold text-xs uppercase tracking-[0.2em] hover:text-slate-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
};

/**
 * DeliveryHomeV2 - Premium 1:1 Match with Original App UI.
 * Featuring logical tab switching for Feed, Pocket, History, and Profile.
 */
export default function DeliveryHomeV2({ tab = 'feed' }) {
  const navigate = useNavigate();
  const { isOnline, setOnline, toggleOnline, activeOrder, tripStatus, setRiderLocation, setActiveOrder, updateTripStatus, clearActiveOrder } = useDeliveryStore();
  const { isWithinRange, distanceToTarget } = useProximityCheck();
  const { acceptOrder, reachPickup, pickUpOrder, reachDrop, completeDelivery, resetTrip } = useOrderManager();
  const { newOrder, clearNewOrder, orderStatusUpdate, clearOrderStatusUpdate, isConnected: isSocketConnected, emitLocation } = useDeliveryNotifications();
  const [isProcessingToggle, setIsProcessingToggle] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [showLowBalanceModal, setShowLowBalanceModal] = useState(false);
  const [eligibilityData, setEligibilityData] = useState(null);
  const companyName = useCompanyName();
  const { unreadCount: notificationUnreadCount } = useNotificationInbox("delivery", { limit: 20 });

    const [incomingOrder, setIncomingOrder] = useState(null);
    const [currentTab, setCurrentTab] = useState(tab);
  
  // Track URL changes (Prop changes) to update sub-page content
  useEffect(() => {
    setCurrentTab(tab);
    if (scrollContainerRef.current) {
       scrollContainerRef.current.scrollTo(0, 0);
    }
}, [tab]);

  const [showVerification, setShowVerification] = useState(false);
  const [showEmergencyPopup, setShowEmergencyPopup] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [emergencyNumbers, setEmergencyNumbers] = useState({
    medicalEmergency: "",
    accidentHelpline: "",
    contactPolice: "",
    insurance: "",
    });
    
    const [isModalMinimized, setIsModalMinimized] = useState(false);
    const [eta, setEta] = useState(null);
    const scrollContainerRef = useRef(null);
    const lastLocationSentAt = useRef(0);
    const lastCoordRef = useRef(null);
    const rollingSpeedRef = useRef([]);
    const lastAutoArrivalRef = useRef({ PICKING_UP: false, PICKED_UP: false });

  const [zoom, setZoom] = useState(14);
  const [isSimMode, setIsSimMode] = useState(false);
  const [simPath, setSimPath] = useState([]);
  const [simIndex, setSimIndex] = useState(0);
  const [simProgress, setSimProgress] = useState(0); // 0 to 1 between points
  const [activePolyline, setActivePolyline] = useState(null);
  const mapRef = useRef(null);
  const isSimModeRef = useRef(isSimMode);

  const handleGeolocationError = useCallback((error) => {
    const hasKnownRiderLocation = Boolean(useDeliveryStore.getState().riderLocation);

    if (!error) {
      if (!hasKnownRiderLocation) {
        toast.error('GPS Needed!');
      }
      return;
    }

    if (error.code === error.PERMISSION_DENIED) {
      toast.error('Location permission denied. Please allow location access.');
      return;
    }

    if (!hasKnownRiderLocation) {
      toast.error('GPS Needed!');
    }
  }, []);

  useEffect(() => {
    isSimModeRef.current = isSimMode;
  }, [isSimMode]);

  const handleSimPathReceived = useCallback((nextPath) => {
    if (!Array.isArray(nextPath) || nextPath.length < 2) return;

    setSimPath((prevPath) => {
      if (isSimModeRef.current && Array.isArray(prevPath) && prevPath.length > 1) {
        return prevPath;
      }

      const isSamePath =
        Array.isArray(prevPath) &&
        prevPath.length === nextPath.length &&
        prevPath.every((point, index) =>
          point?.lat === nextPath[index]?.lat && point?.lng === nextPath[index]?.lng,
        );

      return isSamePath ? prevPath : nextPath;
    });
  }, []);

  const handlePolylineReceived = useCallback((poly) => {
    const normalizedPolyline =
      typeof poly === 'string' ? poly : (poly?.points || null);

    if (!normalizedPolyline) return;

    setActivePolyline((prevPolyline) =>
      prevPolyline === normalizedPolyline ? prevPolyline : normalizedPolyline,
    );
  }, []);

  const isLoggingOut = useRef(false);
  const handleLogout = useCallback(() => {
    if (isLoggingOut.current) return;
    isLoggingOut.current = true;
    
    // 1. Clear tokens and state
    localStorage.removeItem('delivery_accessToken');
    localStorage.removeItem('delivery_refreshToken');
    localStorage.removeItem('delivery_authenticated');
    localStorage.removeItem('delivery_user');
    
    // 2. Alert user and redirect
    toast.error("Session Expired", { description: "Please log in again." });
    navigate("/food/delivery/login", { replace: true });

    // Optional: Full refresh after delay ONLY if we're not already on login
    setTimeout(() => {
       if (!window.location.pathname.includes('/login')) {
          window.location.reload();
       }
    }, 1500);
  }, [navigate]);

  useEffect(() => {
    const onAuthFailure = (e) => {
      if (e.detail?.module === 'delivery') {
        handleLogout();
      }
    };
    window.addEventListener('authRefreshFailed', onAuthFailure);
    return () => window.removeEventListener('authRefreshFailed', onAuthFailure);
  }, [handleLogout]);

  // 0. Auto-Simulation Effect (High-Precision Smooth Glide)
  const lastSimUpdateSentAt = useRef(0);
  useEffect(() => {
    let interval;
    if (isSimMode && simPath.length > 1 && simIndex < simPath.length - 1) {
      console.log('[SimAuto] Glide Active √');
      
      interval = setInterval(() => {
        setSimProgress(prev => {
          const nextProgress = prev + 0.08; // 8% movement per tick
          
          if (nextProgress >= 1) {
            setSimIndex(idx => idx + 1);
            return 0; // Move to next segment
          }

          const currentPoint = simPath[simIndex];
          const nextPoint = simPath[simIndex + 1];

          if (currentPoint && nextPoint) {
            // Linear Interpolation (LERP)
            const lat = currentPoint.lat + (nextPoint.lat - currentPoint.lat) * nextProgress;
            const lng = currentPoint.lng + (nextPoint.lng - currentPoint.lng) * nextProgress;
            const heading = calculateHeading(currentPoint.lat, currentPoint.lng, nextPoint.lat, nextPoint.lng);

            setRiderLocation({ lat, lng, heading });

            if (mapRef.current) {
              mapRef.current.panTo({ lat, lng });
            }

            // Sync with backend every 2.5 seconds during simulation so customer sees it
            const now = Date.now();
            if (now - lastSimUpdateSentAt.current >= 2000) { // Reduced to 2s to match backend throttle
              lastSimUpdateSentAt.current = now;
                const payload = { 
                  lat, 
                  lng, 
                  heading, 
                  orderId: activeOrder?.orderId || activeOrder?._id,
                  status: 'on_the_way',
                 polyline: activePolyline, // Include polyline in every stream update for resilience
                 eta,
                };
              // A. HTTP Backup
              deliveryAPI.updateLocation(lat, lng, true, { heading }).catch(() => {});
              
                // B. SOCKET LIVE (SILKY SMOOTH)
                if (payload.orderId) emitLocation(payload);
              }
            }
            return nextProgress;
          });
      }, 50); // 20 FPS movement
    }
    return () => clearInterval(interval);
  }, [isSimMode, simPath, simIndex, activeOrder, emitLocation, activePolyline, eta, tripStatus]);

  // Fetch Emergency numbers and Profile (Restored logic)
  useEffect(() => {
    (async () => {
      try {
        const [emergencyRes, profileRes] = await Promise.all([
          deliveryAPI.getEmergencyHelp(),
          deliveryAPI.getProfile()
        ]);
        if (emergencyRes?.data?.success && emergencyRes.data.data) {
          setEmergencyNumbers(emergencyRes.data.data);
        }
        if (profileRes?.data?.success && profileRes.data.data?.profile) {
          const profile = profileRes.data.data.profile;
          setProfileImage(profile.profileImage?.url || profile.documents?.photo || null);
        }
      } catch (err) { console.warn('Navbar Data Fetch Error:', err); }
    })();
  }, []);

  const emergencyOptions = [
    { title: "Medical Emergency", subtitle: "Call an ambulance", icon: <AlertTriangle className="text-red-600" />, phone: emergencyNumbers.medicalEmergency },
    { title: "Accident Helpline", subtitle: "Report an accident", icon: <AlertTriangle className="text-orange-600" />, phone: emergencyNumbers.accidentHelpline },
    { title: "Contact Police", subtitle: "Nearest police support", icon: <AlertTriangle className="text-primary" />, phone: emergencyNumbers.contactPolice },
    { title: "Insurance", subtitle: "Policy & claim help", icon: <AlertTriangle className="text-green-600" />, phone: emergencyNumbers.insurance },
  ];

    // Reset simulation only when a new trip/mode starts.
    // Do not reset on every path refresh, or the rider keeps restarting
    // from the beginning of the simulated route.
    useEffect(() => {
      if (isSimMode) {
        console.log('[SimAuto] Resetting simulation playhead...');
        setSimIndex(0);
        setSimProgress(0);
      }
    }, [tripStatus, isSimMode, activeOrder?._id]);

  // Auto-restore modal when status or content changes

  // Auto-restore modal when status or content changes
  useEffect(() => {
    setIsModalMinimized(false);
  }, [tripStatus, showVerification, incomingOrder]);

  // 1. Initial Sync (Force sync with server to avoid 'stuck' persistent state)
  useEffect(() => {
    const syncWithServer = async () => {
      try {
        const response = await deliveryAPI.getCurrentDelivery();
        const rawData = response?.data?.data?.activeOrder || response?.data?.data;
        const serverData = (rawData && (rawData._id || rawData.orderId)) ? rawData : null;
        
        if (serverData) {
          // Robust location mapping (Same as acceptOrder logic)
          const getLoc = (ref, keysLat, keysLng) => {
            if (!ref) return null;
            if (ref.location) {
              if (Array.isArray(ref.location.coordinates) && ref.location.coordinates.length >= 2) {
                return {
                  lat: ref.location.coordinates[1],
                  lng: ref.location.coordinates[0]
                };
              }
              return {
                lat: ref.location.latitude || ref.location.lat,
                lng: ref.location.longitude || ref.location.lng
              };
            }
            for (const k of keysLat) { if (ref[k] != null) return { lat: ref[k], lng: ref[keysLng[keysLat.indexOf(k)]] }; }
            return null;
          };

          const resLoc = getLoc(serverData.restaurantId, ['latitude', 'lat'], ['longitude', 'lng']) || 
                         getLoc(serverData, ['restaurant_lat', 'restaurantLat', 'latitude'], ['restaurant_lng', 'restaurantLng', 'longitude']);
                         
          const cusLoc = getLoc(serverData.deliveryAddress, ['latitude', 'lat'], ['longitude', 'lng']) || 
                         getLoc(serverData, ['customer_lat', 'customerLat', 'latitude'], ['customer_lng', 'customerLng', 'longitude']);

          const syncedOrder = {
            ...serverData,
            pickupPoints: normalizePickupPoints(serverData),
            restaurantLocation: getPrimaryPickupLocation(serverData) || resLoc,
            customerLocation: cusLoc
          };

          setActiveOrder(syncedOrder);
          
          const backendStatus = serverData.deliveryStatus || serverData.orderState?.status || serverData.orderStatus || serverData.status;
          const currentPhase = serverData.deliveryState?.currentPhase;

          if (['delivered', 'completed', 'DELIVERED'].includes(backendStatus)) {
            updateTripStatus('COMPLETED');
          } else if (currentPhase === 'at_drop' || ['reached_drop', 'REACHED_DROP'].includes(backendStatus)) {
            updateTripStatus('REACHED_DROP');
          } else if (['picked_up', 'PICKED_UP', 'delivering'].includes(backendStatus)) {
            updateTripStatus('PICKED_UP');
          } else if (currentPhase === 'at_pickup' || ['reached_pickup', 'REACHED_PICKUP'].includes(backendStatus)) {
            updateTripStatus('REACHED_PICKUP');
          } else if (['confirmed', 'preparing', 'ready_for_pickup'].includes(backendStatus)) {
            updateTripStatus('PICKING_UP');
          }
        } else {
          clearActiveOrder();
        }
      } catch (err) { 
        console.error('Order Sync Failed:', err); 
        clearActiveOrder();
      }
    };
    syncWithServer();
  }, []); // Only on mount to stabilize state
  
  // 1.5 Professional Unified ETA Calculation Hook
  useEffect(() => {
    // If we have distance, calculate ETA. Fallback to 8m/s (28km/h) avg if GPS speed is unknown.
    if (distanceToTarget != null && distanceToTarget !== Infinity) {
      const avgSpeed = rollingSpeedRef.current.length > 0 
        ? rollingSpeedRef.current.reduce((a, b) => a + b, 0) / rollingSpeedRef.current.length 
        : 8;
      
      setEta(calculateETA(distanceToTarget, avgSpeed));
    } else {
      setEta(null);
    }
  }, [distanceToTarget]);

  // 2. Online/Offline Status Sync (REMOVED: Handled manually in toggle for subscription safety)

  // 3. Location logic (Smart Frequency Tracking)
  useEffect(() => {
    if (!isOnline) {
      return;
    }
    
    const watchId = navigator.geolocation.watchPosition((pos) => {
      // CRITICAL: In Simulation Mode, we disable actual GPS to prevent overwriting our test position
      if (isSimMode) return;
      
      const { latitude: lat, longitude: lng, heading, speed } = pos.coords;
      const now = Date.now();
      
      const currentRiderPos = { lat, lng, heading: heading || 0 };
      setRiderLocation(currentRiderPos);
      
      // Calculate Rolling Average Speed for Smart ETA
      if (speed && speed > 0) {
        rollingSpeedRef.current = [...rollingSpeedRef.current.slice(-4), speed]; // keep last 5 points
      }
      
      const avgSpeed = rollingSpeedRef.current.length > 0 
        ? rollingSpeedRef.current.reduce((a, b) => a + b, 0) / rollingSpeedRef.current.length 
        : speed || 0;

      // ETA update is now handled by a separate globally-synchronized effect

      // Phase 11: Geo-fencing Auto-arrival (within 100m) - Disabled in DEV so UI steps can be tested manually
      if (!isSimMode && !import.meta.env.DEV && distanceToTarget && distanceToTarget <= 100 && !lastAutoArrivalRef.current[tripStatus]) {
        if (tripStatus === 'PICKING_UP') {
          lastAutoArrivalRef.current[tripStatus] = true;
          reachPickup().catch(() => { lastAutoArrivalRef.current[tripStatus] = false; });
          // toast.success('Auto-arrived at Restaurant');
        } else if (tripStatus === 'PICKED_UP') {
          lastAutoArrivalRef.current[tripStatus] = true;
          reachDrop().catch(() => { lastAutoArrivalRef.current[tripStatus] = false; });
          // toast.success('Auto-arrived at Customer');
        }
      }

      // Reset auto-arrival flag if we move away or status resets (usually handled by component mount, but for safety)
      if (distanceToTarget > 200) {
        lastAutoArrivalRef.current[tripStatus] = false;
      }

      // Check threshold for Sync (distance-based or 7s time-based)
      const distMoved = lastCoordRef.current 
        ? getHaversineDistance(lat, lng, lastCoordRef.current.lat, lastCoordRef.current.lng) 
        : 1000; // assume huge distance if first update

      if (distMoved >= 25 || (now - lastLocationSentAt.current >= 7000)) {
        lastLocationSentAt.current = now;
        lastCoordRef.current = { lat, lng };
        
          const payload = { 
            lat, 
            lng, 
            heading: heading || 0,
            speed: speed || 0,
            accuracy: pos.coords.accuracy,
            orderId: activeOrder?.orderId || activeOrder?._id,
            status: 'on_the_way',
            polyline: activePolyline,
            eta,
          };

        // A. HTTP Backup
        deliveryAPI.updateLocation(lat, lng, true, { 
          heading: heading || 0,
          speed: speed || 0,
          accuracy: pos.coords.accuracy 
          }).catch(() => {});

          // B. SOCKET LIVE (SILKY SMOOTH)
          if (payload.orderId) emitLocation(payload);
        }
      }, handleGeolocationError, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
      });
      
      return () => navigator.geolocation.clearWatch(watchId);
  }, [isOnline, setRiderLocation, isSimMode, activeOrder, activePolyline, emitLocation, eta, tripStatus, distanceToTarget, reachPickup, reachDrop, handleGeolocationError]);

  // 3.5. Background Ping / Heartbeat
  // If watchPosition stops firing (e.g. app in background or device stationary),
  // this ensures we ping the backend periodically. This keeps the token fresh (via 401 interceptor)
  // and keeps the Delivery Partner "online" in the backend.
  useEffect(() => {
    if (!isOnline) return;
    
    const pingInterval = setInterval(() => {
      const now = Date.now();
      // If no natural GPS update happened in the last 15 seconds, force a ping
      if (now - lastLocationSentAt.current >= 15000 && lastCoordRef.current) {
        lastLocationSentAt.current = now;
        deliveryAPI.updateLocation(
          lastCoordRef.current.lat, 
          lastCoordRef.current.lng, 
          true, 
          { heading: 0, speed: 0, accuracy: null }
        ).catch(() => {});
      }
    }, 10000); // Check every 10 seconds
    
    return () => clearInterval(pingInterval);
  }, [isOnline]);

  useEffect(() => { if (newOrder) setIncomingOrder(newOrder); }, [newOrder]);

  useEffect(() => {
    if (activeOrder && incomingOrder) {
      setIncomingOrder(null);
    }
  }, [activeOrder, incomingOrder]);

  useEffect(() => {
    if (!isOnline) return;
    if (currentTab !== 'feed') return;
    if (activeOrder) return;

    let cancelled = false;

    const hydrateAvailableOrder = async () => {
      try {
        const currentResponse = await deliveryAPI.getCurrentDelivery();
        const currentPayload =
          currentResponse?.data?.data?.activeOrder ||
          currentResponse?.data?.data ||
          null;

        if (!cancelled && currentPayload && (currentPayload._id || currentPayload.orderId)) {
          setActiveOrder({
            ...currentPayload,
            pickupPoints: normalizePickupPoints(currentPayload),
            restaurantLocation: getPrimaryPickupLocation(currentPayload) || currentPayload.restaurantLocation,
          });
          return;
        }

        const availableResponse = await deliveryAPI.getOrders({ limit: 20, page: 1 });
        const availablePayload =
          availableResponse?.data?.data ||
          availableResponse?.data ||
          {};
        const availableOrders = Array.isArray(availablePayload?.docs)
          ? availablePayload.docs
          : Array.isArray(availablePayload?.items)
            ? availablePayload.items
            : Array.isArray(availablePayload)
              ? availablePayload
              : [];

        const nextIncomingOrder = availableOrders.find((order) => {
          const dispatchStatus = String(order?.dispatch?.status || '').toLowerCase();
          const orderStatus = String(order?.orderStatus || order?.status || '').toLowerCase();
          return (
            ['unassigned', 'assigned'].includes(dispatchStatus) &&
            ['confirmed', 'preparing', 'ready_for_pickup'].includes(orderStatus)
          );
        });

        if (!cancelled && nextIncomingOrder) {
          setIncomingOrder((prev) => {
            const prevKey = [
              prev?.orderId || prev?._id || prev?.orderMongoId || '',
              prev?.dispatchLeg?.legId || prev?.legId || '',
            ].filter(Boolean).join(':');
            const nextKey = [
              nextIncomingOrder?.orderId ||
                nextIncomingOrder?._id ||
                nextIncomingOrder?.orderMongoId ||
                '',
              nextIncomingOrder?.dispatchLeg?.legId ||
                nextIncomingOrder?.legId ||
                '',
            ].filter(Boolean).join(':');
            return prevKey === nextKey && prev ? prev : nextIncomingOrder;
          });
        }
      } catch (error) {
        console.warn('[DeliveryHomeV2] Available order fallback sync failed:', error?.message || error);
      }
    };

    void hydrateAvailableOrder();
    const poller = window.setInterval(() => {
      if (!document.hidden) {
        void hydrateAvailableOrder();
      }
    }, isSocketConnected ? 12000 : 5000);

    return () => {
      cancelled = true;
      window.clearInterval(poller);
    };
  }, [activeOrder, currentTab, isOnline, isSocketConnected, setActiveOrder]);

  useEffect(() => {
    if (orderStatusUpdate) {
      if (orderStatusUpdate.status === 'cancelled') {
        toast.error('Order cancelled');
        resetTrip();
      }
      clearOrderStatusUpdate();
    }
  }, [orderStatusUpdate, resetTrip, clearOrderStatusUpdate]);


  const handleCenterMap = () => {
    if (mapRef.current && useDeliveryStore.getState().riderLocation) {
      const loc = useDeliveryStore.getState().riderLocation;
      mapRef.current.panTo({ 
        lat: parseFloat(loc.lat || loc.latitude), 
        lng: parseFloat(loc.lng || loc.longitude) 
      });
    }
  };

  const handleMapClick = (lat, lng) => {
    if (activeOrder || incomingOrder || showVerification) {
      setIsModalMinimized(true);
    }
  };

  return (
    <div className="relative h-screen w-full bg-white text-gray-900 overflow-hidden flex flex-col">
      {/* ─── 1. TOP HEADER (Premium Dark Gray) ─── */}
      {currentTab === 'feed' && (
      <div className="absolute top-0 inset-x-0 bg-[#121212]/95 backdrop-blur-2xl shadow-2xl z-[200] safe-top pb-2 border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-4">
             <div 
                onClick={() => navigate('/food/delivery/profile')}
                className="w-10 h-10 rounded-full border border-white/20 p-0.5 shadow-xl overflow-hidden bg-white/5 cursor-pointer active:scale-95 transition-all"
             >
                <img src={profileImage || "https://i.ibb.co/3m2Yh7r/Appzeto-Brand-Image.png"} alt="Profile" className="w-full h-full object-cover rounded-full" />
             </div>
             <button 
                onClick={async () => {
                  if (isProcessingToggle) return;
                  
                  const turningOn = !isOnline;
                  if (!turningOn) {
                    setIsProcessingToggle(true);
                    try {
                      await deliveryAPI.updateOnlineStatus(false);
                      setOnline(false);
                    } catch (err) {
                      toast.error("Failed to go offline");
                    } finally {
                      setIsProcessingToggle(false);
                    }
                    return;
                  }

                  // Turning ON: Check Eligibility
                  setIsProcessingToggle(true);
                  try {
                    const eligRes = await subscriptionAPI.getEligibility("DELIVERY_PARTNER");
                    const elig = eligRes.data?.data;

                    if (!elig.eligible) {
                      if (elig.reason === 'LOW_BALANCE') {
                        setEligibilityData(elig);
                        setShowLowBalanceModal(true);
                      } else {
                        toast.error(elig.message || "Insufficient balance to go online");
                      }
                      setIsProcessingToggle(false);
                      return;
                    }

                    if (elig.shouldDeduct) {
                      setEligibilityData(elig);
                      setShowSubModal(true);
                      setIsProcessingToggle(false);
                    } else {
                      await deliveryAPI.updateOnlineStatus(true);
                      setOnline(true);
                      setIsProcessingToggle(false);
                      navigator.geolocation.getCurrentPosition((pos) => {
                          deliveryAPI.updateLocation(pos.coords.latitude, pos.coords.longitude, true).catch(() => {});
                      }, (err) => console.warn('Online sync position failed:', err), { enableHighAccuracy: true });
                    }
                  } catch (err) {
                    toast.error("Failed to verify subscription");
                    setIsProcessingToggle(false);
                  }
                }}
                disabled={isProcessingToggle}
                className={`relative w-[92px] h-8 rounded-full p-1 transition-all duration-500 flex items-center ${isOnline ? 'bg-green-500 shadow-lg shadow-green-500/20' : 'bg-gray-400'}`}
             >
                <div className={`flex items-center justify-between w-full px-2 text-[8.5px] font-black uppercase tracking-widest text-white`}>
                  {isProcessingToggle ? (
                    <div className="w-full flex justify-center">
                      <Loader2 className="w-3 h-3 animate-spin" />
                    </div>
                  ) : (
                    <>
                      <span>{isOnline ? 'Online' : ''}</span>
                      <span>{!isOnline ? 'Offline' : ''}</span>
                    </>
                  )}
                </div>
                {!isProcessingToggle && (
                  <motion.div animate={{ x: isOnline ? 59 : 0 }} className="absolute left-1 w-6 h-6 bg-white rounded-full shadow-sm" />
                )}
              </button>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => setShowEmergencyPopup(true)} className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20 active:scale-95 transition-all shadow-lg"><AlertTriangle className="w-4 h-4" /></button>
             <button onClick={() => navigate('/food/delivery/help/id-card')} className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20 active:scale-95 transition-all shadow-lg"><Contact className="w-4 h-4" /></button>
             <button onClick={() => navigate('/food/delivery/notifications')} className="relative w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white border border-white/10 active:scale-95 transition-all shadow-lg"><Bell className="w-4 h-4" />{notificationUnreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-orange-400 border border-[#1f1f1f]" />}</button>
          </div>
        </div>

        {/* ─── LIVE STATUS / PROGRESS BADGE (MATCHED PRO) ─── */}
        <AnimatePresence>
          {currentTab === 'feed' && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="px-4 mt-1"
            >
              {activeOrder ? (
                <div className="grid grid-cols-2 gap-3 w-full">
                  {/* LEFT: DISTANCE (Vibrant Orange Card) */}
                  <div className="bg-[#ff8100] rounded-2xl p-3.5 shadow-xl shadow-orange-500/20 border border-orange-400/50 flex items-center justify-between overflow-hidden relative">
                    <div className="flex flex-col z-10">
                      <span className="text-[9px] text-white/70 font-black uppercase tracking-[0.15em] mb-1">Distance</span>
                      <div className="flex items-end gap-1">
                        <span className="text-2xl font-black text-white leading-none tracking-tighter">
                          {distanceToTarget && distanceToTarget !== Infinity ? (distanceToTarget / 1000).toFixed(1) : '--'}
                        </span>
                        <span className="text-[11px] text-white/80 font-bold mb-0.5">KM</span>
                      </div>
                    </div>
                    <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center z-10 shadow-lg">
                      <Navigation2 className="w-4 h-4 text-[#ff8100] rotate-45" />
                    </div>
                  </div>

                  {/* RIGHT: TIME (Emerald PRO Content) */}
                  <div className="bg-[#10B981] rounded-2xl p-3.5 shadow-xl shadow-green-500/20 border border-green-400/50 flex items-center justify-between relative overflow-hidden group">
                    <div className="flex flex-col z-10">
                      <span className="text-[9px] text-white/70 font-black uppercase tracking-[0.15em] mb-1">Arrival</span>
                      <div className="flex items-end gap-1">
                        <span className="text-2xl font-black text-white leading-none tracking-tighter">
                          {eta ? String(eta) : '--'}
                        </span>
                        <span className="text-[11px] text-white/80 font-bold mb-0.5">MIN</span>
                      </div>
                    </div>
                    <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center z-10 shadow-lg">
                       <Clock className="w-4 h-4 text-[#10B981]" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white/5 rounded-2xl p-4 flex items-center border border-white/5 shadow-sm backdrop-blur-md">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center">
                      <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                    </div>
                    <div>
                      <h3 className="text-white font-black text-[11px] uppercase tracking-widest leading-none mb-1">{isOnline ? 'System Online' : 'System Offline'}</h3>
                      <p className="text-gray-400 text-[10px] font-bold uppercase tracking-tight">{isOnline ? 'Waiting for order requests' : 'Go online to receive jobs'}</p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <SubscriptionConfirmationModal 
          isOpen={showSubModal} 
          onClose={() => setShowSubModal(false)}
          data={eligibilityData}
          loading={isProcessingToggle}
          onConfirm={async () => {
             setIsProcessingToggle(true);
             try {
               await deliveryAPI.updateOnlineStatus(true);
               setOnline(true);
               setShowSubModal(false);
               navigator.geolocation.getCurrentPosition((pos) => {
                 deliveryAPI.updateLocation(pos.coords.latitude, pos.coords.longitude, true).catch(() => {});
               }, (err) => console.warn('Online sync position failed:', err), { enableHighAccuracy: true });
             } catch (err) {
               toast.error("Failed to go online");
             } finally {
               setIsProcessingToggle(false);
             }
          }}
        />

        <LowBalanceBlockingModal
          isOpen={showLowBalanceModal}
          onClose={() => setShowLowBalanceModal(false)}
          data={eligibilityData}
          onRecharge={() => {
            setShowLowBalanceModal(false);
            navigate('/food/delivery/subscription');
          }}
        />
      </div>
      )}

      {/* ─── 2. MAIN CONTENT ─── */}
      <div 
        ref={scrollContainerRef}
        className={`flex-1 relative overflow-y-auto ${currentTab === 'feed' ? 'pt-[120px]' : 'pt-0'} no-scrollbar`}
      >
         {currentTab === 'feed' ? (
           <div className="absolute inset-0 top-[-120px]">
               <LiveMap 
                 onMapLoad={(m) => mapRef.current = m}
                 onMapClick={handleMapClick}
                 onPathReceived={handleSimPathReceived}
                 onPolylineReceived={handlePolylineReceived}
                 zoom={zoom}
                 simulationPath={simPath}
                 simulationIndex={simIndex}
                 simulationProgress={simProgress}
                 simulationLocked={isSimMode && simPath.length > 1}
               />
             
             {/* SIMULATION INDICATOR */}
             {isSimMode && (
               <div className="absolute top-[180px] left-4 right-4 z-[100] bg-black/80 backdrop-blur-md rounded-xl p-4 border border-white/20 flex items-center justify-between shadow-2xl">
                  <div className="flex items-center gap-4">
                     <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center animate-pulse">
                        <Play className="w-4 h-4 text-white fill-current" />
                     </div>
                     <div className="flex flex-col">
                        <span className="text-orange-500 text-[10px] font-bold uppercase tracking-widest">Auto Navigation Active</span>
                        <span className="text-white text-[11px] font-medium">Following actual road path...</span>
                     </div>
                  </div>
                  <button onClick={() => setIsSimMode(false)} className="bg-white/10 text-white/50 hover:text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-white/10">Stop</button>
               </div>
             )}

             <div className="absolute right-4 bottom-28 md:bottom-32 flex flex-col gap-4 z-[120]">
                <div className="flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                   <button onClick={() => setZoom(z => Math.min(22, z + 1))} className="p-3 hover:bg-gray-50 border-b border-gray-100 text-gray-900 active:scale-90 transition-all" aria-label="Zoom in"><Plus className="w-5 h-5 stroke-[2.75]" /></button>
                   <button onClick={() => setZoom(z => Math.max(8, z - 1))} className="p-3 hover:bg-gray-50 text-gray-900 active:scale-90 transition-all" aria-label="Zoom out"><Minus className="w-5 h-5 stroke-[2.75]" /></button>
                </div>
                <button 
                  onClick={() => {
                    const nextSimState = !isSimMode;
                    setIsSimMode(nextSimState);
                    
                    if (nextSimState) {
                      toast.warning('Simulation Mode Active');
                      // Initialize position if null
                      if (!useDeliveryStore.getState().riderLocation && activeOrder) {
                        const target = activeOrder.restaurantLocation || activeOrder.customerLocation;
                        if (target) {
                          setRiderLocation({ 
                            lat: parseFloat(target.lat || target.latitude) + 0.001, 
                            lng: parseFloat(target.lng || target.longitude) + 0.001, 
                            heading: 0 
                          });
                        }
                      }
                    }
                  }}
                  className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center border border-gray-100 transition-all ${isSimMode ? 'bg-orange-500 text-white' : 'bg-white text-orange-500'}`}
                >
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${isSimMode ? 'border-white' : 'border-orange-500'}`}>
                    <Play className={`w-4 h-4 fill-current ml-0.5 ${isSimMode ? 'animate-pulse' : ''}`} />
                  </div>
                </button>
                <button 
                   onClick={() => mapRef.current?.setOptions({ gestureHandling: 'greedy' })} 
                   className="w-14 h-14 bg-white rounded-full shadow-2xl flex items-center justify-center text-orange-500 border border-gray-100 active:scale-90 transition-all"
                >
                  <div className="w-8 h-8 rounded-full border-2 border-orange-500 flex items-center justify-center"><Navigation2 className="w-4 h-4" /></div>
                </button>
                <button 
                  onClick={handleCenterMap}
                  className="w-14 h-14 bg-white rounded-full shadow-2xl flex items-center justify-center text-gray-900 border border-gray-100 group active:scale-90 transition-all"
                >
                  <Target className="w-7 h-7" />
                </button>
             </div>
           </div>
         ) : currentTab === 'pocket' ? (
           <PocketV2 />
         ) : currentTab === 'history' ? (
           <HistoryV2 />
         ) : (
           <ProfileV2 />
         )}

         {/* OVERLAYS (Persistent if active) */}
      </div>

      {/* OVERLAYS (Persistent if active) - Outside flex container to avoid clipping and z-index issues */}
      {(currentTab === 'feed' || activeOrder) && (
        <AnimatePresence>
          {!isModalMinimized && (
            <motion.div
              key="modal-container"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-x-0 top-0 bottom-[92px] z-[300] pointer-events-none flex items-end"
            >
              <div className="w-full pointer-events-auto relative">
                {incomingOrder && (
                  <NewOrderModal 
                    order={incomingOrder} 
                    onAccept={(o) => { acceptOrder(o); setIncomingOrder(null); clearNewOrder(); }}
                    onReject={() => { setIncomingOrder(null); clearNewOrder(); }}
                    onMinimize={() => setIsModalMinimized(true)}
                  />
                )}
                {(tripStatus === 'PICKING_UP' || tripStatus === 'REACHED_PICKUP') && (
                  <PickupActionModal 
                    order={activeOrder} 
                    status={tripStatus} 
                    isWithinRange={isWithinRange} 
                    distanceToTarget={distanceToTarget}
                    eta={eta}
                    onReachedPickup={reachPickup} 
                    onPickedUp={(billImageUrl) => pickUpOrder(billImageUrl)} 
                    onMinimize={() => setIsModalMinimized(true)}
                  />
                )}
                {(tripStatus === 'PICKED_UP' || tripStatus === 'REACHED_DROP') && (
                  <div className="absolute bottom-4 inset-x-0 z-[120] px-4">
                    {tripStatus === 'PICKED_UP' ? (
                      <div className="bg-white rounded-[3rem] p-8 shadow-[0_-20px_80px_rgba(0,0,0,0.4)] border border-gray-100 flex flex-col items-center">
                        {/* Handle / Minimize */}
                        <div className="w-full flex justify-center pb-4 pt-0 -mt-2">
                          <button onClick={() => setIsModalMinimized(true)} className="p-1 hover:bg-gray-100 active:scale-95 transition-all rounded-full flex flex-col items-center">
                             <ChevronDown className="w-6 h-6 text-gray-400 stroke-[3]" />
                          </button>
                        </div>
                        <div className="flex justify-between w-full items-center mb-10 px-2 text-left">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                               <img 
                                 src={activeOrder?.user?.logo || activeOrder?.user?.profileImage || 'https://cdn-icons-png.flaticon.com/512/1275/1275302.png'} 
                                 className="w-full h-full object-cover" 
                                 alt="User"
                               />
                            </div>
                            <div>
                               <h3 className="text-gray-950 text-xl font-bold uppercase line-clamp-1 max-w-[180px]">
                                 {activeOrder?.customerName || activeOrder?.userName || 'Customer'}
                               </h3>
                               <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mt-1.5 ${isWithinRange ? 'text-green-600' : 'text-orange-500'}`}>
                                 {isWithinRange ? 'Ready - Swipe to Arrive √' : `${(distanceToTarget / 1000).toFixed(1)} km • ${eta || '--'} min Arrival`}
                               </p>
                            </div>
                          </div>

                          <div className="flex gap-2 shrink-0">
                            {activeOrder?.isContactProtected ? (
                              <button
                                onClick={() => {
                                  const num = activeOrder?.companySupportNumber?.replace(/\D/g, '') || '';
                                  if (num) window.location.href = `tel:${num}`;
                                  else toast.error('Support number not configured');
                                }}
                                className="px-4 py-2.5 rounded-2xl bg-amber-50 text-amber-700 border border-amber-100 flex items-center gap-2 font-bold text-xs uppercase tracking-wider active:scale-95 transition-all shadow-xs"
                                title="Contact Support"
                              >
                                <Phone className="w-4 h-4 text-amber-600" />
                                <span>Support</span>
                              </button>
                            ) : (
                              (activeOrder?.customerPhone || activeOrder?.userPhone) && (
                                <button
                                  onClick={() => {
                                    const num = (activeOrder?.customerPhone || activeOrder?.userPhone)?.replace(/\D/g, '');
                                    if (num) window.location.href = `tel:${num}`;
                                  }}
                                  className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-600 border border-green-100 shadow-sm active:scale-95 transition-all"
                                  title="Call Customer"
                                >
                                  <Phone className="w-5 h-5" />
                                </button>
                              )
                            )}
                          </div>
                        </div>

                        {/* Privacy Protection Notice */}
                        {activeOrder?.isContactProtected && (
                          <div className="w-full bg-amber-50/70 border border-amber-100 rounded-3xl p-5 mb-8 flex gap-4 items-start shadow-xs text-left mx-2">
                             <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-amber-500 shadow-xs shrink-0 border border-amber-50">
                                <ShieldCheck className="w-5 h-5" />
                             </div>
                             <div className="flex-1">
                                <p className="text-[10px] font-black text-amber-700 uppercase tracking-[0.2em] mb-1.5 opacity-80">🔒 Customer Contact Protected</p>
                                <p className="text-xs font-bold text-gray-800 leading-snug">
                                  {activeOrder.contactMessage || "For privacy and safety reasons, customer contact information is protected. Please contact ItzoFood Support."}
                                </p>
                             </div>
                          </div>
                        )}

                        {/* Customer Instructions Panel */}
                        {activeOrder?.note && (
                          <div className="w-full bg-orange-50 border border-orange-100 rounded-3xl p-5 mb-8 flex gap-4 items-start shadow-sm mx-2">
                             <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-orange-500 shadow-sm shrink-0 border border-orange-50">
                                <Package className="w-5 h-5" />
                             </div>
                             <div className="flex-1 text-left">
                                <p className="text-[10px] font-black text-orange-600 uppercase tracking-[0.2em] mb-1.5 opacity-80">Drop Message</p>
                                <p className="text-sm font-bold text-gray-950 leading-relaxed capitalize">"{activeOrder.note}"</p>
                             </div>
                          </div>
                        )}
                        <ActionSlider label="Slide to Arrive" successLabel="Arrived ✓" disabled={!isWithinRange} onConfirm={reachDrop}  />
                      </div>
                    ) : (
                      <button 
                        onClick={() => setShowVerification(true)} 
                        className="w-full bg-orange-500 hover:bg-orange-500/90 text-white shadow-xl shadow-orange-500/30 rounded-2xl py-5 font-bold text-sm tracking-[0.2em] transform transition-all active:scale-95 flex items-center justify-center gap-3"
                      >
                        <CheckCircle2 className="w-6 h-6" /> VERIFY & COMPLETE
                      </button>
                    )}
                  </div>
                )}
                {showVerification && tripStatus !== 'COMPLETED' && (
                  <DeliveryVerificationModal 
                    order={activeOrder} 
                    onComplete={async (...args) => {
                      const [otpString, verifiedData] = args;
                      const res = await completeDelivery(otpString, { verifiedLegData: verifiedData });
                      setShowVerification(false);
                      return res;
                    }}
                    onClose={() => setShowVerification(false)}
                  />
                )}
                {tripStatus === 'COMPLETED' && <OrderSummaryModal order={activeOrder} onDone={resetTrip} />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* ─── MODALS RESTORED FROM OLD UI ─── */}
      <BottomPopup isOpen={showEmergencyPopup} title="Emergency Help" onClose={() => setShowEmergencyPopup(false)}>
         <div className="grid gap-4 py-2">
           {emergencyOptions.map((opt, i) => (
             <button 
               key={i} 
               onClick={() => {
                 const num = opt.phone?.replace(/\D/g, '');
                 if (num) window.location.href = `tel:${num}`;
                 else toast.error('Number not configured');
               }}
               className="flex items-center gap-5 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 active:scale-95 transition-all text-left"
             >
               <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-xl">{opt.icon}</div>
               <div>
                 <h4 className="font-bold text-gray-900">{opt.title}</h4>
                 <p className="text-xs text-gray-500 font-medium">{opt.subtitle}</p>
               </div>
             </button>
           ))}
         </div>
      </BottomPopup>

      {/* Floating Minimize/Restore Toggle - Above navbar */}
      {isModalMinimized && (activeOrder || incomingOrder || showVerification) && (
        <motion.div 
           initial={{ y: 100, opacity: 0 }}
           animate={{ y: 0, opacity: 1 }}
           className="fixed bottom-[100px] inset-x-0 z-[300] px-6"
        >
           <button 
             onClick={() => setIsModalMinimized(false)}
             className="w-full bg-orange-500/95 text-white rounded-2xl py-4 flex items-center justify-between px-6 shadow-2xl backdrop-blur-md border border-orange-500/20"
           >
              <div className="flex flex-col items-start gap-0.5 text-left">
                 <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">Order Action Pending</span>
                 <span className="text-xs font-bold uppercase tracking-wider">Tap to open delivery panel</span>
              </div>
              <div className="bg-white p-2 rounded-xl text-orange-500">
                 <Plus className="w-5 h-5" />
              </div>
           </button>
        </motion.div>
      )}

      {/* ─── 3. BOTTOM NAV (Fixed - Compact Pro) ─── */}
      <div className="bg-white border-t border-gray-100 px-4 py-3 pb-6 flex justify-between items-center z-[200] shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
         <button onClick={() => navigate('/food/delivery/feed')} className={`flex flex-col items-center gap-1 transition-all ${currentTab === 'feed' ? 'text-gray-950 scale-110' : 'text-gray-400 opacity-70'}`}>
            <LayoutGrid className="w-5 h-5" /><span className="text-[10px] font-medium font-sans">Feed</span>
         </button>
         <button onClick={() => navigate('/food/delivery/pocket')} className={`flex flex-col items-center gap-1 transition-all ${currentTab === 'pocket' ? 'text-gray-950 scale-110' : 'text-gray-400 opacity-70'}`}>
            <Wallet className="w-5 h-5" /><span className="text-[10px] font-medium font-sans">Pocket</span>
         </button>
         <button onClick={() => navigate('/food/delivery/history')} className={`flex flex-col items-center gap-1 transition-all ${currentTab === 'history' ? 'text-gray-950 scale-110' : 'text-gray-400 opacity-70'}`}>
            <History className="w-5 h-5" /><span className="text-[10px] font-medium font-sans">History</span>
         </button>
         <button onClick={() => navigate('/food/delivery/returns')} className={`flex flex-col items-center gap-1 transition-all ${currentTab === 'returns' ? 'text-gray-950 scale-110' : 'text-gray-400 opacity-70'}`}>
            <RotateCcw className="w-5 h-5" /><span className="text-[10px] font-medium font-sans">Returns</span>
         </button>
         <button onClick={() => navigate('/food/delivery/profile')} className={`flex flex-col items-center gap-1 transition-all ${currentTab === 'profile' ? 'text-gray-950 scale-110' : 'text-gray-400 opacity-70'}`}>
            <UserIcon className="w-5 h-5" /><span className="text-[10px] font-medium font-sans">Profile</span>
         </button>
      </div>
      <SubscriptionConfirmationModal 
        isOpen={showSubModal}
        loading={isProcessingToggle}
        onClose={() => setShowSubModal(false)}
        onConfirm={async () => {
          setIsProcessingToggle(true);
          try {
            await deliveryAPI.updateOnlineStatus(true);
            setOnline(true);
            setShowSubModal(false);
            navigator.geolocation.getCurrentPosition((pos) => {
                deliveryAPI.updateLocation(pos.coords.latitude, pos.coords.longitude, true).catch(() => {});
            }, (err) => console.warn('Online sync position failed:', err), { enableHighAccuracy: true });
          } catch (err) {
            toast.error(err.response?.data?.message || "Failed to activate pass");
          } finally {
            setIsProcessingToggle(false);
          }
        }}
      />
    </div>
  );
}
