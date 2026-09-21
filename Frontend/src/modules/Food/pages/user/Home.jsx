import { useSearchParams, Link, useNavigate, useLocation as useRouterLocation } from "react-router-dom";
import React, {
  Suspense,
  lazy,
  useRef,
  useEffect,
  useState,
  useMemo,
  useCallback,
  startTransition,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { isModuleAuthenticated } from "@food/utils/auth";
import { cn } from "@/lib/utils";
import {
  Star,
  Clock,
  MapPin,
  Heart,
  Search,
  Tag,
  Flame,
  ShoppingBag,
  ShoppingCart,
  Mic,
  SlidersHorizontal,
  BadgePercent,
  X,
  ArrowDownUp,
  Timer,
  CalendarClock,
  ShieldCheck,
  IndianRupee,
  AlertCircle,
  Loader2,
  Plus,
  Check,
  ArrowRight,
  UtensilsCrossed,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Bookmark,
  Sparkles,
  TrendingUp,
  Percent,
  Play,
  Share2,
  Leaf,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CategoryChipRowSkeleton,
  ExploreGridSkeleton,
  HeroBannerSkeleton,
  LoadingSkeletonRegion,
  RestaurantCardSkeleton,
  RestaurantGridSkeleton,
} from "@food/components/ui/loading-skeletons";
import { useProfile } from "@food/context/ProfileContext";
import { useCart } from "@food/context/CartContext";
import { HorizontalCarousel } from "@food/components/ui/horizontal-carousel";
import { DotPattern } from "@food/components/ui/dot-pattern";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@food/components/ui/card";
import { Button } from "@food/components/ui/button";
import { Badge } from "@food/components/ui/badge";
import { Input } from "@food/components/ui/input";
import { Switch } from "@food/components/ui/switch";
import { Checkbox } from "@food/components/ui/checkbox";
import {
  useSearchOverlay,
  useLocationSelector,
} from "@food/components/user/UserLayout";

const debugLog = (...args) => { };
const debugWarn = (...args) => { };
const debugError = (...args) => { };

// Import shared food images - prevents duplication
import { foodImages } from "@food/constants/images";

import { Avatar, AvatarFallback } from "@food/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@food/components/ui/dropdown-menu";
import { useLocation } from "@food/hooks/useLocation";
import { useZone } from "@food/hooks/useZone";

import offerImage from "@food/assets/offerimage.png";
import bannerEatingFood from "../../../../assets/eading_food_2_image-removebg-preview.png";
import api, { publicGetOnce, restaurantAPI, adminAPI } from "@food/api";
import { API_BASE_URL } from "@food/api/config";
import OptimizedImage from "@food/components/OptimizedImage";
import { getRestaurantAvailabilityStatus } from "@food/utils/restaurantAvailability";
import HomeHeader from "@food/components/user/home/HomeHeader";
import { LocationProvider as QuickLocationProvider } from "../../../quickCommerce/user/context/LocationContext";
import { ProductDetailProvider as QuickProductDetailProvider } from "../../../quickCommerce/user/context/ProductDetailContext";
import { WishlistProvider as QuickWishlistProvider } from "../../../quickCommerce/user/context/WishlistContext";
import { CartAnimationProvider as QuickCartAnimationProvider } from "../../../quickCommerce/user/context/CartAnimationContext";
import { CartProvider as QuickCartProvider } from "../../../quickCommerce/user/context/CartContext";
import { prefetchQuickHomeBootstrap } from "../../../quickCommerce/user/services/customerApi";
import PromoRow from "@food/components/user/home/PromoRow";
import { useSettings } from "@core/context/SettingsContext";
import { optimizeCloudinaryUrl } from "../../../../shared/utils/cloudinaryUtils";
import VegModePopups from "@food/components/user/VegModePopups";
import AdvertisementSection from "@food/components/user/home/AdvertisementSection";

import * as imgUtils from "@food/utils/imageUtils";
import { useFoodHomeData } from "@food/hooks/useFoodHomeData";
import { ActiveOrderManagerBridge } from "@food/hooks/useActiveOrderManager";
import { parseGeoPoint } from "@food/utils/geo";

// Extracted Sub-components
const BannerSection = lazy(() => import("@food/components/user/home/BannerSection"));
const CategoryRail = lazy(() => import("@food/components/user/home/CategoryRail"));
const RecommendedSection = lazy(() => import("@food/components/user/home/RecommendedSection"));
const RestaurantGrid = lazy(() => import("@food/components/user/home/RestaurantGrid"));
const SortFilterSection = lazy(() => import("@food/components/user/home/SortFilterSection"));
const ExploreMoreSection = lazy(() => import("@food/components/user/home/ExploreMoreSection"));
const HomeDesktopHero = lazy(() => import("@food/components/user/home/HomeDesktopHero"));
const HomeFilterModal = lazy(() => import("@food/components/user/home/HomeFilterModal"));

const MiniCart = lazy(() => import("@food/components/user/MiniCart"));
const OrderTrackingCard = lazy(() => import("@food/components/user/OrderTrackingCard"));
const QuickCommerceHomePage = lazy(() => import("../../../quickCommerce/user/pages/Home"));

// Animated placeholder for search - moved outside component to prevent recreation
const placeholders = [
  'Search "burger"', 'Search "biryani"', 'Search "pizza"', 'Search "desserts"',
  'Search "chinese"', 'Search "thali"', 'Search "momos"', 'Search "dosa"', 'Search "thali"',
];

const quickPlaceholders = [
  'Search "milk"', 'Search "bread"', 'Search "eggs"', 'Search "chips"',
  'Search "fruits"', 'Search "atta"', 'Search "cold drink"', 'Search "ice cream"',
];

const WEBVIEW_SESSION_CACHE_BUSTER = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getStoredDeliveryAddressMode = () => {
  if (typeof window === "undefined") return "saved";
  return window.localStorage.getItem("deliveryAddressMode") || "saved";
};

const defaultBannersImages = [
  "/banner.png",
  "/banner.png",
  "/banner.png"
];

const defaultBannersData = [
  { isFallback: true, title: "Order food & groceries.\nDiscover best restaurants.\nItzoFood it! ⚡", subtitle: "", action: "" },
  { isFallback: true, title: "Order food & groceries.\nDiscover best restaurants.\nItzoFood it! ⚡", subtitle: "", action: "" },
  { isFallback: true, title: "Order food & groceries.\nDiscover best restaurants.\nItzoFood it! ⚡", subtitle: "", action: "" }
];

const tabs = [
  { 
    id: "food", 
    title: "FOOD", 
    subtitle: "FROM RESTAURANTS", 
    discount: "UPTO 30% OFF",
    image: "/super-app/food.png",
    icon: UtensilsCrossed
  },
  {
    id: "quick",
    title: "INSTAMART",
    subtitle: "INSTANT GROCERY",
    discount: "UPTO 20% OFF",
    image: "/super-app/grocery.png",
    icon: ShoppingBag
  },
  {
    id: "street-food",
    title: "STREET FOOD",
    subtitle: "LOCAL VENDORS",
    discount: "LIVE NEARBY",
    image: "/super-app/streetfood.png",
    icon: Flame,
  },
];

export default function Home() {
  const HERO_BANNER_AUTO_SLIDE_MS = 3500;
  const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { settings: appSettings } = useSettings();
  // A module is on unless the admin explicitly switched it off (Global Settings > Modules).
  const quickEnabled = appSettings?.modules?.quickCommerce !== false;
  const streetFoodEnabled = appSettings?.modules?.streetFood !== false;
  const visibleTabs = useMemo(
    () => tabs.filter((tab) =>
      (tab.id !== "quick" || quickEnabled) && (tab.id !== "street-food" || streetFoodEnabled)
    ),
    [quickEnabled, streetFoodEnabled],
  );
  const [heroSearch, setHeroSearch] = useState("");
  const { openSearch, closeSearch, searchValue, setSearchValue } = useSearchOverlay();
  const { openLocationSelector } = useLocationSelector();
  const { vegMode, setVegMode: setVegModeContext, isFavorite, addFavorite, removeFavorite, getDefaultAddress } = useProfile();
  const { cart } = useCart();
  const hasFoodCartItems = useMemo(
    () => cart.some((item) => (item?.orderType || "food") !== "quick"),
    [cart],
  );

  const [prevVegMode, setPrevVegMode] = useState(vegMode);
  const [showVegModePopup, setShowVegModePopup] = useState(false);
  const [showSwitchOffPopup, setShowSwitchOffPopup] = useState(false);
  const [isApplyingVegMode, setIsApplyingVegMode] = useState(false);
  const [isSwitchingOffVegMode, setIsSwitchingOffVegMode] = useState(false);
  const [showAllCategoriesModal, setShowAllCategoriesModal] = useState(false);
  const [availabilityTick, setAvailabilityTick] = useState(Date.now());
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("food");
  // Which restaurants the Food tab shows: normal ("Fixed Restaurant") or the
  // Street Food tile ("Street Food Vendor"). Kept separate from `activeTab` so
  // the food/quick fetch-gating logic in useFoodHomeData is untouched — Street
  // Food stays on the Food tab and just switches which businessType the
  // restaurant list is filtered to (matches the Food/Quick tab-switch UX
  // instead of navigating to a separate page).
  const [foodBusinessType, setFoodBusinessType] = useState(() =>
    searchParams.get("service") === "streetfood" && streetFoodEnabled ? "Street Food Vendor" : "Fixed Restaurant"
  );

  // Module switched off while the customer is on that view → fall back to plain Food.
  useEffect(() => {
    if (!streetFoodEnabled && foodBusinessType === "Street Food Vendor") {
      setFoodBusinessType("Fixed Restaurant");
    }
  }, [streetFoodEnabled, foodBusinessType]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [mountedTabs, setMountedTabs] = useState(() => new Set(["food"]));
  const [showToast, setShowToast] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const heroShellRef = useRef(null);
  const restaurantLoadMoreRef = useRef(null);
  const isHandlingSwitchOff = useRef(false);
  const routerLocation = useRouterLocation();

  // --- Location Logic ---
  const { location } = useLocation();
  const { zoneId: liveZoneId, isInService: isLiveInService } = useZone(location);
  const defaultSavedAddress = useMemo(() => getDefaultAddress?.() || null, [getDefaultAddress]);
  const defaultSavedAddressLocation = useMemo(() => {
    if (!defaultSavedAddress) return null;
    // Same pin parsing as Cart checkout (swap-aware).
    const point = parseGeoPoint(defaultSavedAddress);
    return {
      ...defaultSavedAddress,
      latitude: point?.lat ?? null,
      longitude: point?.lng ?? null,
      area: defaultSavedAddress.additionalDetails || defaultSavedAddress.area || "",
      zipCode: defaultSavedAddress.zipCode || defaultSavedAddress.postalCode || "",
      postalCode: defaultSavedAddress.postalCode || defaultSavedAddress.zipCode || "",
    };
  }, [defaultSavedAddress]);
  const { zoneId: savedZoneId, isInService: isSavedInService } = useZone(defaultSavedAddressLocation);

  const deliveryAddressMode = getStoredDeliveryAddressMode();
  const effectiveZoneId = (deliveryAddressMode === "current" ? liveZoneId : savedZoneId) || liveZoneId;
  const effectiveLocation = (deliveryAddressMode === "current" ? location : defaultSavedAddressLocation) || location;

  // --- Core Data Hook ---
  const isFoodRoute = !routerLocation.pathname.endsWith("/quick");
  
  const {
    banners,
    categories,
    restaurants,
    landing,
    meta,
    advertisements,
    actions,
    state
  } = useFoodHomeData({
    zoneId: effectiveZoneId,
    location: effectiveLocation,
    vegMode,
    backendOrigin: BACKEND_ORIGIN,
    availabilityTick,
    businessType: foodBusinessType,
    enabled: isFoodRoute
  });

  // --- UI Effects ---
  useEffect(() => {
    const intervalId = setInterval(() => {
      startTransition(() => setAvailabilityTick(Date.now()));
    }, 60000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const activePlaceholders = activeTab === "quick" ? quickPlaceholders : placeholders;
      setPlaceholderIndex((prev) => (prev + 1) % activePlaceholders.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const activeBannerImages = useMemo(() => {
    // Override API images with the custom transparent PNGs requested by the user
    if (banners?.data?.length > 0) {
      return banners.data.map((_, i) => defaultBannersImages[i % defaultBannersImages.length]);
    }
    return defaultBannersImages;
  }, [banners?.data]);

  const activeBannerData = defaultBannersData;

  const desktopBannerImages = useMemo(() => [
    "/desktop-banner.png",
    "/scooter-banner.png",
    "/banner.png",
    "/offer-banner.png"
  ], []);

  // Auto-slide banners
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => prev + 1);
    }, HERO_BANNER_AUTO_SLIDE_MS);
    return () => clearInterval(interval);
  }, []);
  // Prevent body scroll when popups are open
  useEffect(() => {
    if (showVegModePopup || showSwitchOffPopup || showAllCategoriesModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showVegModePopup, showSwitchOffPopup, showAllCategoriesModal]);

  // Sync activeTab with URL
  useEffect(() => {
    const path = routerLocation.pathname;
    const targetTab = path.endsWith("/quick")
      ? "quick"
      : "food";
    if (activeTab !== targetTab) setActiveTab(targetTab);
    setMountedTabs((prev) => {
      if (prev.has(targetTab)) return prev;
      const next = new Set(prev);
      next.add(targetTab);
      return next;
    });
  }, [routerLocation.pathname]);

  // --- Handlers ---
  const handleTabChange = (tab) => {
    startTransition(() => setActiveTab(tab));
    if (tab === "quick") navigate("/quick");
    else navigate("/food/user");
  };

  const handleVegModeChange = (newValue) => {
    if (isHandlingSwitchOff.current) return;
    if (newValue && !vegMode) setShowVegModePopup(true);
    else if (!newValue && vegMode) {
      isHandlingSwitchOff.current = true;
      setShowSwitchOffPopup(true);
    } else {
      setVegModeContext(newValue);
    }
  };

  const handleSearchFocus = useCallback(() => {
    if (activeTab === "quick") navigate("/quick/search");
    else {
      if (heroSearch) setSearchValue(heroSearch);
      openSearch();
    }
  }, [activeTab, heroSearch, navigate, openSearch, setSearchValue]);

  const handleFavoriteToggle = useCallback((e, restaurant, slug, favorite) => {
    if (!isModuleAuthenticated('user')) {
      toast.error("Please login to save restaurants");
      navigate('/user/auth/login', { state: { from: window.location.pathname } });
      return;
    }
    if (favorite) removeFavorite(slug);
    else {
      addFavorite({ ...restaurant, slug });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    }
  }, [addFavorite, removeFavorite, navigate]);

  // --- Render ---
  return (
    <div className="relative min-h-screen overflow-x-clip bg-white pb-16 dark:bg-[#0a0a0a] md:pb-8">
      <div className="sticky top-0 z-[50] overflow-x-clip md:hidden bg-white dark:bg-[#0a0a0a]">
        {!state.isBootstrapped && activeTab === "food" ? (
          <div className="px-4 pt-6 pb-4">
            <div className="h-10 w-48 bg-slate-100 animate-pulse rounded-xl mb-6" />
            <div className="h-14 w-full bg-slate-100 animate-pulse rounded-2xl" />
          </div>
        ) : (
          <HomeHeader
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            location={location}
            savedAddressText={imgUtils.formatSavedAddress(effectiveLocation)}
            handleLocationClick={() => openLocationSelector()}
            handleSearchFocus={handleSearchFocus}
            placeholderIndex={placeholderIndex}
            placeholders={activeTab === "quick" ? quickPlaceholders : placeholders}
            vegMode={vegMode}
            onVegModeChange={handleVegModeChange}
            headerVideoUrl={landing.videoUrl}
          />
        )}
      </div>

      {state.isBootstrapped && activeTab === "food" && (
        <div className="relative z-10 w-full">
          <div
            className="relative overflow-hidden shadow-sm pb-3.5 rounded-[20px] md:rounded-none mx-3 sm:mx-4 md:mx-0 mt-0"
            style={{
              background: vegMode
                ? "linear-gradient(135deg, #2e7d32 0%, #388e3c 100%)"
                : "linear-gradient(135deg, #FE5502 0%, #C83C00 100%)",
            }}
          >
            <Suspense fallback={<HeroBannerSkeleton className="h-[130px] w-full" />}>
              <div className="h-[130px] sm:h-36 md:h-[450px] lg:h-[500px] mt-0 relative z-10 w-full px-0">
                {/* Mobile Slider */}
                <div className="block md:hidden h-full w-full">
                  <BannerSection
                    showBannerSkeleton={banners.loading}
                    heroBannerImages={activeBannerImages}
                    heroBannersData={activeBannerData}
                    currentBannerIndex={activeBannerImages.length ? currentBannerIndex % activeBannerImages.length : 0}
                    setCurrentBannerIndex={setCurrentBannerIndex}
                    heroShellRef={heroShellRef}
                    navigate={navigate}
                  />
                </div>
                {/* Desktop Slider */}
                <div className="hidden md:block absolute inset-0 z-0">
                  <BannerSection
                    showBannerSkeleton={banners.loading}
                    heroBannerImages={desktopBannerImages}
                    heroBannersData={activeBannerData}
                    currentBannerIndex={desktopBannerImages.length ? currentBannerIndex % desktopBannerImages.length : 0}
                    setCurrentBannerIndex={setCurrentBannerIndex}
                    heroShellRef={heroShellRef}
                    navigate={navigate}
                    hideOverlay={true}
                  />
                </div>
                <div className="hidden md:flex absolute inset-0 flex-col items-center justify-center text-white text-center z-10 px-4 mt-[-60px] pointer-events-none">
                  <h1 className="text-3xl lg:text-4xl font-bold mb-3 drop-shadow-md">
                    Order food & groceries <br /> from your favourite restaurants.
                  </h1>
                  <p className="text-xl lg:text-2xl font-bold drop-shadow-md">ItzoFood It! 🔥</p>
                </div>
              </div>
            </Suspense>

            {/* Banner Search and Location */}
            <div className="px-4 pt-0 -mt-2 relative z-20 md:hidden md:max-w-3xl md:mx-auto md:pb-8 md:-mt-16">
              <div className="flex w-full items-center bg-white rounded-full shadow-lg overflow-hidden relative pr-2 border border-gray-100">
                {/* Location */}
                <button
                  type="button"
                  onClick={() => openLocationSelector()}
                  className="flex items-center gap-1.5 px-4 py-3 bg-transparent border-0 hover:bg-gray-50 transition-colors shrink-0 max-w-[140px]"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-[#FE5502]" strokeWidth={2.5} />
                  <div className="flex items-center min-w-0">
                    <span className="truncate text-xs font-bold text-gray-800">
                      {imgUtils.formatSavedAddress(effectiveLocation) || "Select Location"}
                    </span>
                    <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 text-gray-800" strokeWidth={2.5} />
                  </div>
                </button>

                <div className="h-6 w-px bg-gray-200 shrink-0" />

                {/* Search */}
                <button
                  type="button"
                  onClick={handleSearchFocus}
                  className="flex-1 flex items-center justify-between px-3 py-3 bg-transparent border-0 text-left hover:bg-gray-50 transition-colors min-w-0"
                >
                  <span className="block truncate text-xs text-gray-400 font-medium w-full">
                    {placeholders?.[placeholderIndex] || "Search for restaurants, food or more"}
                  </span>
                  <Search className="h-4 w-4 shrink-0 text-gray-400 ml-2" strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={activeTab === "food" ? "relative mx-auto w-full max-w-7xl md:px-4 lg:px-8" : "hidden"}>
        <div className="bg-white dark:bg-[#0a0a0a]">
      {/* TABS SECTION / CARDS SECTION — always visible (matches old itzo's HomeHeader
          switcher) so Food/Instamart/Street Food stay reachable even while on Quick. */}
      <div className={cn(
        "grid md:flex md:justify-center gap-2 md:gap-4 px-3 py-3 sm:px-4 sm:py-4 mx-auto w-full max-w-7xl relative z-20 bg-white dark:bg-[#0a0a0a]",
        visibleTabs.length >= 3 ? "grid-cols-3" : visibleTabs.length === 2 ? "grid-cols-2" : "grid-cols-1"
      )}>
        {visibleTabs.map((tab) => {
          const isActive = tab.id === "street-food"
            ? foodBusinessType === "Street Food Vendor"
            : tab.id === "food"
            ? activeTab === "food" && foodBusinessType !== "Street Food Vendor"
            : activeTab === tab.id;
          const handleTabIntent = () => {
            if (tab.id === "quick") onQuickTabIntent?.();
          };
          const handleTabClick = () => {
            if (tab.id === "street-food") {
              startTransition(() => setFoodBusinessType("Street Food Vendor"));
              if (activeTab !== "food") handleTabChange("food");
              return;
            }
            if (tab.id === "food") {
              startTransition(() => setFoodBusinessType("Fixed Restaurant"));
            }
            handleTabChange(tab.id);
          };

          return (
            <button
              key={tab.id}
              type="button"
              onClick={handleTabClick}
              onMouseEnter={handleTabIntent}
              onTouchStart={handleTabIntent}
              onFocus={handleTabIntent}
              className={cn(
                "relative border overflow-hidden shadow-sm transition-all duration-300 text-left w-full",
                "rounded-[16px] h-[85px] min-[380px]:h-[95px] p-2 sm:p-2.5",
                "md:rounded-[20px] md:h-[120px] md:w-[280px] md:p-0",
                isActive 
                  ? "bg-rose-50/80 border-rose-200 shadow-sm scale-[1.02]" 
                  : tab.id === "quick"
                  ? "bg-amber-50/60 border-amber-100 hover:bg-amber-50 hover:border-amber-200 hover:shadow-md hover:scale-[1.01]"
                  : "bg-white border-gray-100 hover:border-gray-200 hover:shadow-md hover:scale-[1.01]"
              )}
            >
              {/* MOBILE CONTENT (Original Layout) */}
              <div className="flex flex-col justify-between h-full md:hidden">
                {/* Top content */}
                <div className="flex gap-1.5 w-full items-start z-10">
                  <div className="bg-[#FE5502] text-white rounded-full p-1 shrink-0 flex items-center justify-center h-[20px] w-[20px] mt-0.5">
                    <tab.icon className="h-3 w-3" strokeWidth={2.5} />
                  </div>
                  <div className="flex flex-col min-w-0 mt-0.5">
                    <span className="text-[9.5px] min-[380px]:text-[10.5px] sm:text-[12px] font-bold text-gray-900 leading-tight truncate">
                      {tab.title}
                    </span>
                    <p className="text-[7px] sm:text-[8px] font-medium text-gray-500 uppercase tracking-tight mt-0.5 truncate">
                      {tab.subtitle}
                    </p>
                  </div>
                </div>

                {/* Bottom content: arrow and image */}
                <div className="mt-1 flex items-end justify-between w-full z-10">
                  <div className="bg-[#FE5502] text-white rounded-full p-1 shrink-0 flex items-center justify-center h-4 w-4 shadow-sm mb-0.5">
                    <ArrowRight className="h-2.5 w-2.5" strokeWidth={3} />
                  </div>
                  <div className="absolute right-[-4px] bottom-[-4px] w-[55px] h-[55px] min-[380px]:w-[65px] min-[380px]:h-[65px] pointer-events-none">
                    <img src={tab.image} className="w-full h-full object-contain drop-shadow-sm" alt={tab.title} />
                  </div>
                </div>
              </div>

              {/* DESKTOP CONTENT (New Layout) */}
              <div className="hidden md:flex justify-between h-full w-full p-4">
                {/* Left Content (Text and Arrow) */}
                <div className="flex flex-col justify-between h-full z-10 w-[65%]">
                  {/* Icon + Text */}
                  <div className="flex items-start gap-2">
                    <div className="bg-[#FE5502] text-white rounded-full p-1.5 shrink-0 flex items-center justify-center md:h-[28px] md:w-[28px]">
                      <tab.icon className="md:h-4 md:w-4" strokeWidth={2.5} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="md:text-[15px] font-extrabold text-gray-900 leading-tight truncate tracking-tight">
                        {tab.title}
                      </span>
                      <p className="md:text-[9px] font-bold text-gray-500 uppercase tracking-wider mt-0.5 truncate">
                        {tab.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Arrow Button */}
                  <div className="bg-[#FE5502] text-white rounded-full shrink-0 flex items-center justify-center md:h-6 md:w-6 shadow-sm">
                    <ArrowRight className="md:h-3.5 md:w-3.5" strokeWidth={3} />
                  </div>
                </div>

                {/* Right Content (Image) */}
                <div className="absolute right-0 bottom-0 top-0 md:w-[45%] pointer-events-none flex items-end justify-end md:pr-4 md:pb-2">
                  <img src={tab.image} className="md:h-[85%] md:w-auto object-contain drop-shadow-sm transition-transform duration-500 ease-out group-hover:scale-110" alt={tab.title} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
            <Suspense fallback={<CategoryChipRowSkeleton className="py-1" />}>
              <CategoryRail
                displayCategories={categories.display}
                showCategorySkeleton={categories.loading}
                navigate={navigate}
                setShowAllCategoriesModal={setShowAllCategoriesModal}
                backendOrigin={BACKEND_ORIGIN}
                hasOffers={restaurants.loading ? true : (restaurants.visible || []).some(r => r.offer)}
              />
            </Suspense>

            <Suspense fallback={null}>
              <AdvertisementSection advertisements={advertisements} BACKEND_ORIGIN={BACKEND_ORIGIN} />
            </Suspense>

            <Suspense fallback={null}>
              <RecommendedSection 
                recommendedForYouRestaurants={meta.recommended} 
                isFavorite={isFavorite}
                onFavoriteToggle={handleFavoriteToggle}
              />
            </Suspense>

            <Suspense fallback={<HeroBannerSkeleton className="h-full w-full px-4 mt-3" />}>
              {(banners.loading || (banners.images && banners.images.length > 0)) && (
                <section className="content-auto px-4 py-2 sm:py-3 lg:py-6 max-w-7xl mx-auto">
                  {/* Mobile Slider */}
                  <div className="block md:hidden overflow-hidden rounded-[20px] h-48 sm:h-64 shadow-lg border border-gray-100">
                    <BannerSection
                      showBannerSkeleton={banners.loading}
                      heroBannerImages={banners.images}
                      heroBannersData={banners.data}
                      currentBannerIndex={banners.images?.length ? currentBannerIndex % banners.images.length : 0}
                      setCurrentBannerIndex={setCurrentBannerIndex}
                      heroShellRef={heroShellRef}
                      navigate={navigate}
                      backendOrigin={BACKEND_ORIGIN}
                      hideOverlay={true}
                    />
                  </div>
                  {/* Desktop Banners (Side-by-side Row) */}
                  <div className="hidden md:flex w-full overflow-x-auto snap-x gap-4 px-2 pb-4 items-center scrollbar-hide" style={{ scrollBehavior: 'smooth' }}>
                    {(banners.images || []).map((img, i) => (
                      <div key={i} className="min-w-[calc(33.333%-10.66px)] snap-start rounded-[20px] overflow-hidden relative shadow-sm aspect-[21/9] group hover:shadow-md transition-shadow cursor-pointer">
                         <OptimizedImage
                            src={img}
                            alt={`Promo Banner ${i+1}`}
                            className="w-full h-full group-hover:scale-105 transition-transform duration-500"
                            objectFit="cover"
                            backendOrigin={BACKEND_ORIGIN}
                         />
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </Suspense>

            <Suspense fallback={null}>
              <ExploreMoreSection
                exploreMoreHeading={landing.heading}
                showExploreSkeleton={landing.loading}
                finalExploreItems={landing.exploreMore}
                backendOrigin={BACKEND_ORIGIN}
              />
            </Suspense>

            <Suspense fallback={null}>
              <SortFilterSection
                activeFilters={state.activeFilters}
                toggleFilter={actions.toggleFilter}
                setIsFilterOpen={setIsFilterOpen}
              />
            </Suspense>

            <Suspense fallback={null}>
              <HomeFilterModal 
                isOpen={isFilterOpen} 
                onClose={() => setIsFilterOpen(false)} 
                activeFilters={state.activeFilters} 
                toggleFilter={actions.toggleFilter} 
              />
            </Suspense>

            <Suspense fallback={<RestaurantGridSkeleton count={3} />}>
              <RestaurantGrid
                filteredRestaurants={restaurants.visible}
                visibleRestaurants={restaurants.visible}
                showRestaurantSkeleton={restaurants.loading}
                isLoadingFilterResults={restaurants.isLoadingFilterResults}
                loadingRestaurants={restaurants.loading}
                availabilityTick={availabilityTick}
                isFavorite={isFavorite}
                onFavoriteToggle={handleFavoriteToggle}
                backendOrigin={BACKEND_ORIGIN}
                hasMoreRestaurants={restaurants.hasMore}
                loadMoreRestaurants={actions.loadMoreRestaurants}
                restaurantLoadMoreRef={restaurantLoadMoreRef}
                advertisements={advertisements}
              />
            </Suspense>
        </div>
      </div>

      {mountedTabs.has("quick") && (
        <div className={activeTab === "quick" ? "bg-transparent" : "hidden"}>
          <QuickLocationProvider>
            <QuickCartProvider>
              <QuickWishlistProvider>
                <QuickCartAnimationProvider>
                  <QuickProductDetailProvider>
                    <Suspense fallback={<div className="h-screen w-full bg-white dark:bg-[#0a0a0a]" />}>
                      <QuickCommerceHomePage embedded />
                    </Suspense>
                  </QuickProductDetailProvider>
                </QuickCartAnimationProvider>
              </QuickWishlistProvider>
            </QuickCartProvider>
          </QuickLocationProvider>
        </div>
      )}

      {/* Veg Mode Popups (Enable / Switch Off) */}
      <VegModePopups
        showVegModePopup={showVegModePopup}
        showSwitchOffPopup={showSwitchOffPopup}
        onCloseVegPopup={(level) => {
          setShowVegModePopup(false);
          if (level) {
            setVegModeContext(level);
          }
        }}
        onCloseSwitchOffPopup={() => {
          setShowSwitchOffPopup(false);
          isHandlingSwitchOff.current = false;
        }}
        onConfirmSwitchOff={() => {
          setVegModeContext(false);
          setShowSwitchOffPopup(false);
          isHandlingSwitchOff.current = false;
        }}
      />

      {/* Category Modal */}
      <AnimatePresence>
        {showAllCategoriesModal && (
          <div className="fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-[#1a1a1a]">
            <HomeHeader embedded location={location} savedAddressText="All Categories" handleLocationClick={() => setShowAllCategoriesModal(false)} />
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-3 gap-6">
              {categories.display.map(cat => (
                <Link key={cat.id} to={`/user/category/${cat.slug}`} className="flex flex-col items-center gap-2" onClick={() => setShowAllCategoriesModal(false)}>
                  <div className="w-20 h-20 rounded-full overflow-hidden shadow-sm bg-gray-50">
                    <OptimizedImage src={cat.image} className="w-full h-full object-cover" backendOrigin={BACKEND_ORIGIN} />
                  </div>
                  <span className="text-xs font-semibold text-center">{cat.name}</span>
                </Link>
              ))}
            </div>
            <Button className="m-6 rounded-2xl" variant="secondary" onClick={() => setShowAllCategoriesModal(false)}>Close</Button>
          </div>
        )}
      </AnimatePresence>

      {hasFoodCartItems && <Suspense fallback={null}><MiniCart /></Suspense>}
      {/* Active-order probe only on food/quick home (banner lives here) — not on /quick/product etc. */}
      <ActiveOrderManagerBridge />
      <Suspense fallback={null}><OrderTrackingCard hasBottomNav /></Suspense>
    </div>
  );
}
