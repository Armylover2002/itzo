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
import { AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
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
  CheckCircle2,
  Bookmark,
  BadgePercent,
  X,
  ArrowDownUp,
  Timer,
  CalendarClock,
  ShieldCheck,
  IndianRupee,
  UtensilsCrossed,
  Leaf,
  AlertCircle,
  Loader2,
  Plus,
  Check,
  Share2,
  MapPinOff,
} from "lucide-react";

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
import bannerEatingBoy from "../../../../assets/eating_boy_image-removebg-preview.png";
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
import { optimizeCloudinaryUrl } from "../../../../shared/utils/cloudinaryUtils";
import VegModePopups from "@food/components/user/VegModePopups";

import * as imgUtils from "@food/utils/imageUtils";
import { useFoodHomeData } from "@food/hooks/useFoodHomeData";

// Extracted Sub-components
const BannerSection = lazy(() => import("@food/components/user/home/BannerSection"));
const CategoryRail = lazy(() => import("@food/components/user/home/CategoryRail"));
const RecommendedSection = lazy(() => import("@food/components/user/home/RecommendedSection"));
const RestaurantGrid = lazy(() => import("@food/components/user/home/RestaurantGrid"));
const SortFilterSection = lazy(() => import("@food/components/user/home/SortFilterSection"));
const ExploreMoreSection = lazy(() => import("@food/components/user/home/ExploreMoreSection"));

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
  bannerEatingBoy,
  bannerEatingFood,
  bannerEatingBoy
];

const defaultBannersData = [
  { isFallback: true, title: "A SIX IS HIT! 🏏", subtitle: "66% OFF FOR 10 MIN!", action: "Order Now" },
  { isFallback: true, title: "MATCH DAY SPECIAL", subtitle: "Free Delivery on Pizza", action: "Explore" },
  { isFallback: true, title: "CRAVINGS SATISFIED", subtitle: "Flat ₹150 Off", action: "Claim Offer" }
];

export default function Home() {
  const HERO_BANNER_AUTO_SLIDE_MS = 3500;
  const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api(\/v1)?\/?$/i, "");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
  const routerLocation = useRouterLocation();
  // Derived from the URL on first render (not corrected afterwards via effect)
  // so the Food tab's restaurant fetch never fires even for a single render
  // when landing directly on /quick.
  const [activeTab, setActiveTab] = useState(() =>
    routerLocation.pathname.endsWith("/quick") ? "quick" : "food",
  );
  const [quickThemeColor, setQuickThemeColor] = useState("#FE5502");
  const [showToast, setShowToast] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const heroShellRef = useRef(null);
  const restaurantLoadMoreRef = useRef(null);
  const isHandlingSwitchOff = useRef(false);

  // --- Location Logic ---
  const { location } = useLocation();
  const { zoneId: liveZoneId, isInService: isLiveInService, isOutOfService: isLiveOutOfService } = useZone(location);
  const defaultSavedAddress = useMemo(() => getDefaultAddress?.() || null, [getDefaultAddress]);
  const defaultSavedAddressLocation = useMemo(() => {
    if (!defaultSavedAddress) return null;
    const coords = defaultSavedAddress?.location?.coordinates;
    const latitude = Array.isArray(coords) && coords.length >= 2 ? coords[1] : (defaultSavedAddress.latitude ?? null);
    const longitude = Array.isArray(coords) && coords.length >= 2 ? coords[0] : (defaultSavedAddress.longitude ?? null);
    return {
      ...defaultSavedAddress,
      latitude,
      longitude,
      area: defaultSavedAddress.additionalDetails || defaultSavedAddress.area || "",
      zipCode: defaultSavedAddress.zipCode || defaultSavedAddress.postalCode || "",
      postalCode: defaultSavedAddress.postalCode || defaultSavedAddress.zipCode || "",
    };
  }, [defaultSavedAddress]);
  const { zoneId: savedZoneId, isInService: isSavedInService, isOutOfService: isSavedOutOfService } = useZone(defaultSavedAddressLocation);

  const deliveryAddressMode = getStoredDeliveryAddressMode();
  const effectiveZoneId = (deliveryAddressMode === "current" ? liveZoneId : savedZoneId) || liveZoneId;
  const effectiveLocation = (deliveryAddressMode === "current" ? location : defaultSavedAddressLocation) || location;
  const isEffectiveOutOfService = (deliveryAddressMode === "current" ? isLiveOutOfService : isSavedOutOfService) ?? isLiveOutOfService;

  // --- Core Data Hook ---
  const {
    banners,
    categories,
    restaurants,
    landing,
    meta,
    actions,
    state
  } = useFoodHomeData({
    zoneId: effectiveZoneId,
    location: effectiveLocation,
    vegMode,
    backendOrigin: BACKEND_ORIGIN,
    availabilityTick,
    activeTab
  });

  // --- UI Effects ---
  useEffect(() => {
    const intervalId = setInterval(() => setAvailabilityTick(Date.now()), 60000);
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

  const activeBannerData = useMemo(() => banners?.data?.length > 0 ? banners.data : defaultBannersData, [banners?.data]);

  // Auto-slide banners
  useEffect(() => {
    if (!activeBannerImages.length) return;
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % activeBannerImages.length);
    }, HERO_BANNER_AUTO_SLIDE_MS);
    return () => clearInterval(interval);
  }, [activeBannerImages.length]);

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
    const isQuick = routerLocation.pathname.endsWith("/quick");
    const targetTab = isQuick ? "quick" : "food";
    if (activeTab !== targetTab) setActiveTab(targetTab);
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

  // --- Render ---
  return (
    <div className="relative min-h-screen bg-white dark:bg-[#0a0a0a] pb-16 md:pb-6 overflow-x-clip">
      <div className="md:hidden relative overflow-x-clip z-[50]">
        {!state.isBootstrapped ? (
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
            quickThemeColor={quickThemeColor}
            bannerComponent={
              <Suspense fallback={<HeroBannerSkeleton className="h-[130px] w-full" />}>
                <div className="h-[130px] sm:h-36 md:h-44 mt-3 relative z-10 w-full">
                  <BannerSection
                    showBannerSkeleton={banners.loading}
                    heroBannerImages={activeBannerImages}
                    heroBannersData={activeBannerData}
                    currentBannerIndex={currentBannerIndex}
                    setCurrentBannerIndex={setCurrentBannerIndex}
                    heroShellRef={heroShellRef}
                    navigate={navigate}
                  />
                </div>
              </Suspense>
            }
          />
        )}
      </div>

      <QuickLocationProvider>
        <QuickCartProvider>
          <QuickWishlistProvider>
            <QuickCartAnimationProvider>
              <QuickProductDetailProvider>
                {isEffectiveOutOfService && state.isBootstrapped ? (
                  <div className="flex flex-col items-center justify-center py-24 px-6 text-center min-h-[60vh] bg-white dark:bg-[#0a0a0a]">
                    <div className="bg-red-50 dark:bg-red-500/10 p-6 rounded-full mb-6">
                      <MapPinOff className="w-16 h-16 text-red-500" strokeWidth={1.5} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3 tracking-tight">
                      Service Not Available
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto leading-relaxed text-sm md:text-base">
                      We're sorry, but we don't currently deliver to this location. Please change your location to explore our restaurants and products.
                    </p>
                    <Button 
                      onClick={() => openLocationSelector()}
                      className="rounded-full px-8 py-6 bg-primary hover:bg-primary/90 text-white font-semibold text-base shadow-lg hover:shadow-xl transition-all active:scale-95"
                    >
                      Change Location
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className={activeTab === "food" ? "block" : "hidden"}>
                      <div className="bg-white dark:bg-[#0a0a0a]">
                        <Suspense fallback={<CategoryChipRowSkeleton className="py-1" />}>
                          <CategoryRail
                            displayCategories={categories.display}
                            showCategorySkeleton={categories.loading}
                            navigate={navigate}
                            setShowAllCategoriesModal={setShowAllCategoriesModal}
                            backendOrigin={BACKEND_ORIGIN}
                          />
                        </Suspense>

                        <Suspense fallback={null}>
                          <RecommendedSection recommendedForYouRestaurants={meta.recommended} />
                        </Suspense>


                        <Suspense fallback={<HeroBannerSkeleton className="h-full w-full px-4 mt-3" />}>
                          <section className="content-auto px-4 py-4 sm:py-6 lg:py-8">
                            <div className="overflow-hidden rounded-2xl h-48 sm:h-64 md:h-72 lg:h-[350px] shadow-lg border border-gray-100">
                              <BannerSection
                                showBannerSkeleton={banners.loading}
                                heroBannerImages={banners.images}
                                heroBannersData={banners.data}
                                currentBannerIndex={currentBannerIndex}
                                setCurrentBannerIndex={setCurrentBannerIndex}
                                heroShellRef={heroShellRef}
                                navigate={navigate}
                                backendOrigin={BACKEND_ORIGIN}
                                hideOverlay={true}
                              />
                            </div>
                          </section>
                        </Suspense>

                        <Suspense fallback={null}>
                          <SortFilterSection
                            activeFilters={state.activeFilters}
                            toggleFilter={actions.toggleFilter}
                            setIsFilterOpen={(val) => { }} // Hook handles internal apply
                          />
                        </Suspense>

                        <Suspense fallback={null}>
                          <ExploreMoreSection
                            exploreMoreHeading={landing.heading}
                            showExploreSkeleton={landing.loading}
                            finalExploreItems={landing.exploreMore}
                            backendOrigin={BACKEND_ORIGIN}
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
                            onFavoriteToggle={(e, restaurant, slug, favorite) => {
                              if (favorite) removeFavorite(slug);
                              else {
                                addFavorite({ ...restaurant, slug });
                                setShowToast(true);
                                setTimeout(() => setShowToast(false), 2000);
                              }
                            }}
                            backendOrigin={BACKEND_ORIGIN}
                            hasMoreRestaurants={restaurants.hasMore}
                            loadMoreRestaurants={actions.loadMoreRestaurants}
                            restaurantLoadMoreRef={restaurantLoadMoreRef}
                          />
                        </Suspense>
                      </div>
                    </div>

                    <div className={activeTab === "quick" ? "block" : "hidden"}>
                      <div className="bg-white dark:bg-[#0a0a0a]">
                        <Suspense fallback={<div className="h-screen w-full bg-white dark:bg-[#0a0a0a]" />}>
                          <QuickCommerceHomePage
                            embedded
                            onThemeChange={() => {}}
                            embeddedHeaderColor="#FE5502"
                          />
                        </Suspense>
                      </div>
                    </div>
                  </>
                )}
              </QuickProductDetailProvider>
            </QuickCartAnimationProvider>
          </QuickWishlistProvider>
        </QuickCartProvider>
      </QuickLocationProvider>

      {/* Veg Mode Popups (Enable / Switch Off) */}
      <VegModePopups
        showVegModePopup={showVegModePopup}
        showSwitchOffPopup={showSwitchOffPopup}
        onCloseVegPopup={(level) => {
          setShowVegModePopup(false);
          if (level === "pure" || level === "all") {
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

      {activeTab === "food" && hasFoodCartItems && <Suspense fallback={null}><MiniCart /></Suspense>}
      <Suspense fallback={null}><OrderTrackingCard hasBottomNav /></Suspense>
    </div>
  );
}
