import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Lottie from 'lottie-react';
import {
  ArrowLeft,
  Banknote,
  Check,
  ChevronRight,
  CreditCard,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  Tag,
  Timer,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useAuth } from '@core/context/AuthContext';
import { useProfile } from '@food/context/ProfileContext';
import { Button } from '@/components/ui/button';
import { useSettings } from '@core/context/SettingsContext';
import { useToast } from '@shared/components/ui/Toast';
import { useCart } from '../context/CartContext';
import { customerApi } from '../services/customerApi';
import emptyBoxAnimation from '../assets/lottie/Empty box.json';
import { getQuickCategoriesPath, getQuickCheckoutPath } from '../utils/routes';
import { resolveQuickImageUrl } from '../utils/image';
import { useLocation as useAppLocation } from '../context/LocationContext';
import LocationDrawer from '../components/shared/LocationDrawer';
import {
  buildCategoryRateMaps,
  calculateQuickDeliveryFee,
  calculateQuickGstAmount,
  calculateQuickHandlingFee,
} from '../utils/quickPricing';
import {
  computeQuickCouponDiscount,
  formatCouponDiscountLabel,
  formatCouponSourceLabel,
  getCouponDetailLines,
} from '../utils/couponDisplay';
import { getVariantDisplayLabel } from '../utils/productMeta';
import { getRoadDistanceDetails } from '@/shared/services/roadDistance';

// â”€â”€â”€ Pure helpers (outside component — no closure allocation on each render) â”€â”€

const DEFAULT_QUICK_BILLING_SETTINGS = {
  deliveryFee: 0,
  deliveryFeeRanges: [],
  freeDeliveryThreshold: 0,
  platformFee: 0,
};

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=200&auto=format&fit=crop';

const CHECKOUT_STORAGE_KEY = 'quick_commerce_checkout_state_v1';
const CURRENT_LOC_CARD_ID = 'current-loc';

const looksLikeLatLng = (value) => {
  const v = String(value || '').trim();
  return /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(v);
};

const formatFullAddress = (address) => {
  if (!address) return '';

  const formatted =
    address.formattedAddress ||
    address.name ||
    address.address ||
    '';
  if (formatted && formatted !== 'Select location' && formatted !== 'Select delivery location' && !looksLikeLatLng(formatted)) {
    // Avoid showing the label "Current Location" as the address body
    if (String(formatted).trim().toLowerCase() !== 'current location') {
      return String(formatted).trim();
    }
  }

  const parts = [
    address.street,
    address.additionalDetails,
    address.city,
    address.state,
    address.zipCode || address.pincode,
  ].filter(Boolean);

  if (parts.length) return parts.join(', ');
  if (address.address && !looksLikeLatLng(address.address)) return String(address.address).trim();
  return '';
};

const normalizeChipLabel = (label) => {
  const value = String(label || '').trim().toLowerCase();
  if (value === 'work' || value === 'office') return 'office';
  if (value === 'home') return 'home';
  if (value === 'other') return 'other';
  return value;
};

const getDisplayAddressLabel = (label) => {
  const normalized = normalizeChipLabel(label);
  if (normalized === 'office') return 'Work';
  if (normalized === 'home') return 'Home';
  if (normalized === 'other') return 'Other';
  if (String(label || '').trim().toLowerCase() === 'current location') return 'Current Location';
  return label || 'Saved address';
};

const isGpsCurrentLocation = (location) =>
  location?.type === 'current' ||
  String(location?.name || '').trim().toLowerCase() === 'current location';

const resolveCartSellerId = (cartItems = []) => {
  const item = (cartItems || []).find(
    (entry) =>
      entry?.sellerId ||
      entry?.seller?._id ||
      entry?.sellerId?._id ||
      entry?.quickStoreId ||
      entry?.storeId,
  );
  if (!item) return '';
  const raw =
    item?.sellerId?._id ||
    item?.sellerId ||
    item?.seller?._id ||
    item?.quickStoreId ||
    item?.storeId ||
    '';
  const sellerId = String(raw?._id || raw || '').trim();
  if (!sellerId || sellerId === 'quick-commerce') return '';
  return sellerId;
};

const readStoredCheckoutCoupon = () => {
  try {
    const stored = localStorage.getItem(CHECKOUT_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    return parsed?.selectedCoupon || null;
  } catch {
    return null;
  }
};

const persistCheckoutCoupon = (selectedCoupon) => {
  try {
    const stored = localStorage.getItem(CHECKOUT_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    localStorage.setItem(
      CHECKOUT_STORAGE_KEY,
      JSON.stringify({
        ...parsed,
        selectedCoupon,
      }),
    );
  } catch {
    /* ignore */
  }
};

const sanitizeQuickFeeSettings = (feeSettings = {}) => {
  // Legacy feeSettings.gstRate / return window must never drive QC GST or returns
  // (Header Category is the source of truth).
  const {
    gstRate: _ignoredGstRate,
    returnsEnabled: _legacyReturnsEnabled,
    returnWindowHours: _legacyReturnWindowHours,
    ...rest
  } = feeSettings || {};
  return rest;
};

const calculateQuickCartPricing = ({
  subtotal = 0,
  cartItems = [],
  feeSettings = DEFAULT_QUICK_BILLING_SETTINGS,
  categoryFeeMap = {},
  categoryGstMap = {},
  distanceKm = 0,
  discountAmount = 0,
}) => {
  const safeSubtotal = Number(subtotal || 0);
  const safeFees = sanitizeQuickFeeSettings(feeSettings);

  const deliveryFee =
    safeSubtotal > 0
      ? calculateQuickDeliveryFee({
          feeSettings: safeFees,
          distanceKm,
          subtotal: safeSubtotal,
        })
      : 0;

  const handlingFee = calculateQuickHandlingFee(cartItems, categoryFeeMap);
  const packagingFee = cartItems.reduce((acc, item) => {
    return acc + (Number(item?.packingFee || 0) * Number(item?.quantity || 0));
  }, 0);
  const platformFee = Number(safeFees?.platformFee || 0);
  // GST % from Header Category map only (supports mixed-category carts).
  const gstAmount = calculateQuickGstAmount(cartItems, categoryGstMap, discountAmount);

  return {
    deliveryFee,
    handlingFee,
    packagingFee,
    platformFee,
    gstAmount,
    grandTotal: Math.max(
      0,
      safeSubtotal + deliveryFee + handlingFee + packagingFee + platformFee + gstAmount,
    ),
  };
};

// â”€â”€â”€ Sub-components (memoized to prevent list re-renders) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CartItem = React.memo(({ item, onRemove, onUpdateQuantity, showToast }) => {
  const imageUrl = resolveQuickImageUrl(item.mainImage || item.image) || item.mainImage || item.image || FALLBACK_IMAGE;
  const itemTotal = Number(item.price || 0) * Number(item.quantity || 0);
  const stock = Number(item.stock ?? Infinity);
  const variantLabel = item?.selectedVariant
    ? getVariantDisplayLabel(item.selectedVariant, item)
    : String(item?.variantName || "").trim();

  const handleRemove = useCallback(() => onRemove(item), [onRemove, item]);
  const handleDecr = useCallback(() => onUpdateQuantity(item.id || item._id, -1), [onUpdateQuantity, item.id, item._id]);
  const handleIncr = useCallback(() => {
    if (item.quantity >= stock) { showToast(`Only ${stock} items are available in stock.`, 'error'); return; }
    onUpdateQuantity(item.id || item._id, 1);
  }, [onUpdateQuantity, item.id, item._id, item.quantity, stock, showToast]);

  const handleImgError = useCallback((e) => { e.currentTarget.src = FALLBACK_IMAGE; }, []);

  return (
    <article className="rounded-xl bg-white dark:bg-card p-2.5 shadow-sm border border-slate-100 dark:border-white/10">
      <div className="flex gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50 dark:bg-white/5">
          <img
            src={imageUrl}
            alt={item.name}
            className="h-full w-full object-contain p-1.5"
            onError={handleImgError}
            loading="lazy"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="line-clamp-2 text-[13px] font-semibold text-slate-800 dark:text-slate-100 leading-snug">{item.name}</h2>
              {variantLabel ? (
                <p className="mt-0.5 text-[11px] font-medium text-rose-700/80 dark:text-rose-400">{variantLabel}</p>
              ) : (
                <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">{item.weight || item.unit || '1 unit'}</p>
              )}
            </div>
            <button
              onClick={handleRemove}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-slate-500 transition-colors hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
            >
              <Trash2 size={14} />
            </button>
          </div>

          <div className="mt-2 flex items-end justify-between gap-2">
            <div>
              <p className="text-[13px] font-semibold tabular-nums tracking-normal text-slate-800 dark:text-slate-100">₹{itemTotal}</p>
              {item.quantity > 1 && (
                <p className="text-[10px] font-medium tabular-nums text-slate-400 dark:text-slate-500">₹{item.price} each</p>
              )}
            </div>

            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 dark:bg-white/10 px-1.5 py-0.5">
              <button
                onClick={handleDecr}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white dark:bg-card text-slate-700 dark:text-slate-200 shadow-sm"
              >
                <Minus size={12} strokeWidth={2.5} />
              </button>
              <span className="min-w-[16px] text-center text-[13px] font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                {item.quantity}
              </span>
              <button
                onClick={handleIncr}
                disabled={item.quantity >= stock}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white dark:bg-card text-slate-700 dark:text-slate-200 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={12} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
});
CartItem.displayName = 'CartItem';

const CartCouponRow = React.memo(function CartCouponRow({ coupon, isApplied, onApply, onRemove, cartSubtotal = 0 }) {
  const discountLabel = formatCouponDiscountLabel(coupon);
  const sourceLabel = formatCouponSourceLabel(coupon);
  const detailLines = getCouponDetailLines(coupon, cartSubtotal).filter(
    (line) => line && line !== discountLabel,
  );

  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-rose-100 dark:border-rose-500/20 bg-gradient-to-r from-rose-50/80 to-white dark:from-rose-500/10 dark:to-card p-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100">{coupon.code}</p>
          {discountLabel ? (
            <span className="rounded-full bg-rose-100/80 dark:bg-rose-500/20 px-2 py-0.5 text-[10px] font-medium tracking-wide text-rose-700 dark:text-rose-300 tabular-nums">
              {discountLabel}
            </span>
          ) : null}
          {sourceLabel ? (
            <span className="rounded-full bg-slate-900/5 dark:bg-white/10 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
              {sourceLabel}
            </span>
          ) : null}
        </div>
        {detailLines.length > 0 ? (
          <div className="mt-1 space-y-0.5">
            {detailLines.map((line) => (
              <p key={line} className="text-[11px] font-medium text-slate-600 dark:text-slate-400 tabular-nums">
                {line}
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-[11px] font-medium text-slate-600 dark:text-slate-400">Special offer</p>
        )}
      </div>
      {isApplied ? (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded-lg bg-slate-100 dark:bg-white/10 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-200 dark:hover:bg-white/15"
        >
          Remove
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onApply(coupon)}
          className="shrink-0 rounded-lg bg-rose-600/90 px-2.5 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-rose-700"
        >
          Apply
        </button>
      )}
    </div>
  );
});
CartCouponRow.displayName = 'CartCouponRow';

// â”€â”€â”€ Main CartPage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CartPage = () => {
  const navigate = useNavigate();
  const {
    cart,
    removeFromCart,
    updateQuantity,
    cartTotal,
    clearCart,
    loading,
    serverCartRevision = 0,
  } = useCart();
  const { showToast } = useToast();
  const { settings } = useSettings();
  const { currentLocation, savedAddresses, updateLocation, refreshAddresses, isFetchingLocation } = useAppLocation();
  const { user, isAuthenticated } = useAuth();
  const { userProfile } = useProfile();

  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [quickBillingSettings, setQuickBillingSettings] = useState(DEFAULT_QUICK_BILLING_SETTINGS);
  const [categoryFeeMap, setCategoryFeeMap] = useState({});
  const [categoryGstMap, setCategoryGstMap] = useState({});
  const [isUserCodAllowed, setIsUserCodAllowed] = useState(true);
  const [codOrderLimit, setCodOrderLimit] = useState(null);
  const [storeLocation, setStoreLocation] = useState(null);
  const [distanceKm, setDistanceKm] = useState(0);
  const [distanceEstimated, setDistanceEstimated] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState('cash');
  const [walletBalance, setWalletBalance] = useState(Number(userProfile?.walletBalance || 0));
  const [coupons, setCoupons] = useState([]);
  const [selectedCoupon, setSelectedCoupon] = useState(() => readStoredCheckoutCoupon());
  const [isCouponsLoading, setIsCouponsLoading] = useState(false);
  const [serverPricing, setServerPricing] = useState(null);
  const [isPricingLoading, setIsPricingLoading] = useState(false);

  // â”€â”€ Stable path constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const categoriesPath = useMemo(() => getQuickCategoriesPath(), []);
  const checkoutPath = useMemo(() => getQuickCheckoutPath(), []);

  // â”€â”€ Derived values â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const itemCount = useMemo(
    () => cart.reduce((n, item) => n + Number(item.quantity || 0), 0),
    [cart],
  );

  const clientDiscountAmount = useMemo(
    () => computeQuickCouponDiscount(selectedCoupon, cartTotal),
    [selectedCoupon, cartTotal],
  );

  // Client fallback while server preview lags behind local +/- qty / coupon apply
  const clientPricing = useMemo(
    () =>
      calculateQuickCartPricing({
        subtotal: cartTotal,
        cartItems: cart,
        feeSettings: quickBillingSettings,
        categoryFeeMap,
        categoryGstMap,
        distanceKm,
        discountAmount: clientDiscountAmount,
      }),
    [cartTotal, cart, quickBillingSettings, categoryFeeMap, categoryGstMap, distanceKm, clientDiscountAmount],
  );

  const isFreeDeliveryCoupon = useMemo(() => {
    const type = String(
      serverPricing?.couponType ||
        selectedCoupon?.couponType ||
        selectedCoupon?.discountType ||
        '',
    ).toLowerCase();
    return type === 'free_delivery';
  }, [serverPricing?.couponType, selectedCoupon]);

  const hasServerPricing = Boolean(serverPricing && serverPricing.source === 'server');
  // Prefer local cart lines for qty-tied amounts so +/- updates bill immediately.
  // Server preview can lag behind debounced cart/update and coupon apply.
  const serverSubtotalMatches =
    hasServerPricing &&
    Math.abs(Number(serverPricing.subtotal || 0) - Number(cartTotal || 0)) < 0.51;
  const selectedCouponCode = String(selectedCoupon?.code || '').trim().toUpperCase();
  const serverCouponCode = String(serverPricing?.couponCode || '').trim().toUpperCase();
  const serverCouponAligned =
    (!selectedCouponCode && !serverCouponCode) ||
    (Boolean(selectedCouponCode) && serverCouponCode === selectedCouponCode);
  const useServerBill = serverSubtotalMatches && serverCouponAligned;

  const billSubtotal = Number(cartTotal || 0);
  const deliveryFee = useServerBill
    ? Number(serverPricing.deliveryFee || 0)
    : (isFreeDeliveryCoupon ? 0 : Number(clientPricing.deliveryFee || 0));
  const handlingFee = useServerBill
    ? Number(serverPricing.handlingFee || 0)
    : Number(clientPricing.handlingFee || 0);
  const packagingFee = useServerBill
    ? Number(serverPricing.packagingFee || 0)
    : Number(clientPricing.packagingFee || 0);
  const platformFee = hasServerPricing
    ? Number(serverPricing.platformFee || 0)
    : Number(clientPricing.platformFee || 0);
  const discountAmount = useServerBill
    ? Number(serverPricing.discount || 0)
    : clientDiscountAmount;
  const gstAmount = useServerBill
    ? Number(serverPricing.gst || serverPricing.tax || 0)
    : Number(clientPricing.gstAmount || 0);
  const couponDiscountLabel = formatCouponDiscountLabel(selectedCoupon);
  const effectiveDeliveryFee = deliveryFee;
  const grandTotal = Math.max(
    0,
    Number(billSubtotal || 0) -
      Number(discountAmount || 0) +
      Number(effectiveDeliveryFee || 0) +
      Number(handlingFee || 0) +
      Number(packagingFee || 0) +
      Number(platformFee || 0) +
      Number(gstAmount || 0),
  );
  const codLimitApplies = Number.isFinite(Number(codOrderLimit)) && Number(codOrderLimit) > 0;
  const isCodBlockedByOrderValue = codLimitApplies && Number(grandTotal || 0) > Number(codOrderLimit);
  const codBlockedMessage = isCodBlockedByOrderValue
    ? `Cash on Delivery available up to ₹${Math.round(Number(codOrderLimit))} only`
    : '';

  const paymentMethods = useMemo(
    () => [
      ...(settings?.onlineEnabled === false
        ? []
        : [{ id: 'online', label: 'Pay Online', icon: CreditCard, sublabel: 'UPI / Cards / NetBanking' }]),
      ...(isAuthenticated ? [{
        id: 'wallet',
        label: 'Wallet',
        icon: Wallet,
        sublabel: `Balance: ₹${Number(walletBalance || 0).toLocaleString('en-IN')}`,
        disabled: Number(walletBalance || 0) < Number(grandTotal || 0),
      }] : []),
      ...(settings?.codEnabled === false || !isUserCodAllowed || isCodBlockedByOrderValue
        ? []
        : [{ id: 'cash', label: 'Cash on Delivery', icon: Banknote, sublabel: 'Pay after delivery' }]),
    ],
    [settings?.onlineEnabled, settings?.codEnabled, isUserCodAllowed, isAuthenticated, walletBalance, grandTotal, isCodBlockedByOrderValue],
  );

  const selectedPaymentMethod = useMemo(
    () => paymentMethods.find((m) => m.id === selectedPayment) || null,
    [paymentMethods, selectedPayment],
  );

  // â”€â”€ Stable cart fingerprints (avoid refetch on identical cart content) â”€â”€â”€â”€â”€
  const cartSellerId = useMemo(() => resolveCartSellerId(cart), [cart]);
  const cartCouponKey = useMemo(() => {
    const sellerIds = [
      ...new Set(
        (cart || [])
          .map((item) => resolveCartSellerId([item]))
          .filter(Boolean),
      ),
    ].sort();
    const productIds = [
      ...new Set(
        (cart || [])
          .map((item) =>
            String(item?.productId || item?.itemId || item?.id || item?._id || '')
              .trim()
              .split('::')[0],
          )
          .filter((id) => id && id.length >= 12),
      ),
    ].sort();
    const qtySig = (cart || [])
      .map((item) => `${String(item?.id || item?._id || '')}:${Number(item?.quantity || 0)}`)
      .sort()
      .join('|');
    return JSON.stringify({ sellerIds, productIds, qtySig });
  }, [cart]);

  const userLat = Number(currentLocation?.latitude || currentLocation?.lat);
  const userLng = Number(currentLocation?.longitude || currentLocation?.lng);

  // â”€â”€ Effects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // Server-authoritative bill preview (same math as placeOrder)
  useEffect(() => {
    if (!cart.length) {
      setServerPricing(null);
      setIsPricingLoading(false);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsPricingLoading(true);
      try {
        const payload = {
          latitude: Number.isFinite(userLat) ? userLat : undefined,
          longitude: Number.isFinite(userLng) ? userLng : undefined,
          couponCode: selectedCoupon?.code || null,
          couponSource: selectedCoupon?.isSellerCoupon
            ? 'seller'
            : (selectedCoupon?.couponSource || selectedCoupon?.source || null),
        };
        const res = await customerApi.previewCheckout(payload);
        if (cancelled) return;
        if (res?.data?.success && res.data.result) {
          const result = res.data.result;
          setServerPricing(result);
          if (Number.isFinite(Number(result.distanceKm))) {
            setDistanceKm(Number(result.distanceKm));
            setDistanceEstimated(Boolean(result.distanceEstimated));
          }
          if (result.couponError && selectedCoupon?.code) {
            // Soft mismatch — keep coupon UI but server ignored invalid code
          }
        } else {
          setServerPricing(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load server cart pricing:', err);
          setServerPricing(null);
        }
      } finally {
        if (!cancelled) setIsPricingLoading(false);
      }
    // Wait past qty debounce so preview usually hits the updated server cart.
    // serverCartRevision also re-runs after a successful cart/update flush.
    }, 550);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    cartCouponKey,
    cart.length,
    serverCartRevision,
    userLat,
    userLng,
    selectedCoupon?.code,
    selectedCoupon?.isSellerCoupon,
    selectedCoupon?.couponSource,
    selectedCoupon?.source,
  ]);

  // Fetch store location from first cart item's seller (client fallback for distance)
  useEffect(() => {
    let mounted = true;

    if (!cartSellerId) {
      setStoreLocation(null);
      setDistanceKm(0);
      setDistanceEstimated(false);
      return undefined;
    }

    customerApi.getStoreDetails(cartSellerId).then((response) => {
      if (!mounted) return;
      const store = response?.data?.result || response?.data?.data || null;
      if (!store) return;

      const loc = store.location;
      let sCoords = null;
      if (Array.isArray(loc?.coordinates) && loc.coordinates.length === 2) {
        sCoords = { lat: Number(loc.coordinates[1]), lng: Number(loc.coordinates[0]) };
      } else if (Number.isFinite(Number(loc?.latitude)) && Number.isFinite(Number(loc?.longitude))) {
        sCoords = { lat: Number(loc.latitude), lng: Number(loc.longitude) };
      }
      setStoreLocation(sCoords);
    }).catch((err) => console.error('Failed to fetch store details:', err));

    return () => { mounted = false; };
  }, [cartSellerId]);

  // Fetch seller + admin coupons for this cart
  useEffect(() => {
    let mounted = true;
    const fetchCoupons = async () => {
      setIsCouponsLoading(true);
      try {
        let parsed = { sellerIds: [], productIds: [] };
        try {
          parsed = JSON.parse(cartCouponKey || '{}');
        } catch {
          parsed = { sellerIds: [], productIds: [] };
        }
        const sellerIds = Array.isArray(parsed.sellerIds) ? parsed.sellerIds : [];
        const productIds = Array.isArray(parsed.productIds) ? parsed.productIds : [];
        const params = {};
        if (sellerIds.length === 1) params.sellerId = sellerIds[0];
        if (sellerIds.length > 1) params.sellerIds = sellerIds.join(',');
        if (!sellerIds.length && productIds.length) {
          params.productIds = productIds.join(',');
        }

        // Use cache/dedupe — no forceRefresh (was causing 3–4 parallel coupon calls)
        const res = await customerApi.getActiveCoupons(params);
        if (!mounted) return;
        if (res?.data?.success) {
          const list = res.data.results || res.data.result || [];
          setCoupons(Array.isArray(list) ? list : []);
        } else {
          setCoupons([]);
        }
      } catch (err) {
        console.error('Failed to fetch cart coupons:', err);
        if (mounted) setCoupons([]);
      } finally {
        if (mounted) setIsCouponsLoading(false);
      }
    };
    fetchCoupons();
    return () => { mounted = false; };
  }, [cartCouponKey]);

  // Keep selected coupon in checkout storage so checkout page picks it up
  useEffect(() => {
    persistCheckoutCoupon(selectedCoupon);
  }, [selectedCoupon]);

  // Clear coupon if cart empties or subtotal drops below min order
  useEffect(() => {
    if (!selectedCoupon?.code) return;
    if (cart.length === 0) {
      setSelectedCoupon(null);
      return;
    }
    const minOrder = Number(selectedCoupon.minOrderValue || selectedCoupon.minOrder || 0);
    if (minOrder > 0 && Number(cartTotal || 0) < minOrder) {
      const code = selectedCoupon.code;
      setSelectedCoupon(null);
      showToast(`Coupon ${code} removed — minimum order ₹${minOrder} required`, 'info');
    }
  }, [cart.length, cartTotal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute distance whenever store or user coords change (primitives only)
  useEffect(() => {
    if (!storeLocation) {
      setDistanceKm(0);
      setDistanceEstimated(false);
      return undefined;
    }

    const lat1 = storeLocation.lat;
    const lon1 = storeLocation.lng;
    let cancelled = false;

    const loadDistance = async () => {
      if (Number.isFinite(lat1) && Number.isFinite(lon1) && Number.isFinite(userLat) && Number.isFinite(userLng)) {
        const details = await getRoadDistanceDetails(lat1, lon1, userLat, userLng);
        if (!cancelled) {
          setDistanceKm(Number.isFinite(details?.distanceKm) ? details.distanceKm : 0);
          setDistanceEstimated(Boolean(details?.estimated));
        }
      } else if (!cancelled) {
        setDistanceKm(0);
        setDistanceEstimated(false);
      }
    };

    void loadDistance();
    return () => { cancelled = true; };
  }, [storeLocation?.lat, storeLocation?.lng, userLat, userLng]);

  // One-shot mount bootstrap: billing + categories + profile + wallet
  useEffect(() => {
    let mounted = true;

    Promise.all([
      customerApi.getBillingSettings(),
      customerApi.getCategories({ tree: true }),
      customerApi.getProfile().catch(() => null),
      isAuthenticated ? customerApi.getWalletBalance().catch(() => null) : Promise.resolve(null),
    ]).then(([billingResponse, categoriesResponse, profileResponse, walletResponse]) => {
      if (!mounted) return;

      const billingRoot = billingResponse?.data?.data?.feeSettings || billingResponse?.data?.result || {};
      const nextCodLimit = Number(billingRoot?.codOrderLimit || 0);
      setCodOrderLimit(Number.isFinite(nextCodLimit) && nextCodLimit > 0 ? nextCodLimit : null);

      const feeSettings = sanitizeQuickFeeSettings(billingRoot || null);
      if (feeSettings && Object.keys(feeSettings).length) {
        setQuickBillingSettings((prev) => ({
          ...prev,
          ...feeSettings,
          deliveryFeeRanges: Array.isArray(feeSettings.deliveryFeeRanges)
            ? feeSettings.deliveryFeeRanges
            : prev.deliveryFeeRanges,
        }));
      }

      const results = categoriesResponse?.data?.results || categoriesResponse?.data?.result || [];
      if (Array.isArray(results) && results.length) {
        const { categoryFeeMap: nextFeeMap, categoryGstMap: nextGstMap } =
          buildCategoryRateMaps(results);
        setCategoryFeeMap(nextFeeMap);
        setCategoryGstMap(nextGstMap);
      }

      const profile =
        profileResponse?.data?.result ||
        profileResponse?.data?.data ||
        profileResponse?.data?.user ||
        null;
      if (profile) setIsUserCodAllowed(profile.isCodAllowed !== false);

      const wallet =
        walletResponse?.data?.data?.wallet ||
        walletResponse?.data?.result?.wallet;
      if (wallet?.balance != null) {
        setWalletBalance(Number(wallet.balance) || 0);
      } else if (userProfile?.walletBalance != null) {
        setWalletBalance(Number(userProfile.walletBalance) || 0);
      }
    }).catch((err) => console.error('Failed to bootstrap cart page data:', err));

    // Hydrate addresses from session cache when possible (no forced network)
    refreshAddresses?.(false);

    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Sync selectedPayment when paymentMethods list changes
  useEffect(() => {
    if (!paymentMethods.length) return;
    if (!paymentMethods.some((m) => m.id === selectedPayment)) {
      setSelectedPayment(paymentMethods[0].id);
    }
  }, [paymentMethods, selectedPayment]);

  // Keep check-out state's address in sync with global currentLocation updates
  useEffect(() => {
    if (!currentLocation?.name) return;
    try {
      const stored = localStorage.getItem(CHECKOUT_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : {};

      if (parsed.currentAddress?.address !== currentLocation.name) {
        const nextAddress = {
          ...parsed.currentAddress,
          address: currentLocation.name,
          city: currentLocation.city || parsed.currentAddress?.city || "Indore",
          landmark: parsed.currentAddress?.landmark || "",
          location: currentLocation.latitude && currentLocation.longitude
            ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
            : parsed.currentAddress?.location,
        };

        localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify({
          ...parsed,
          currentAddress: nextAddress
        }));
      }
    } catch (err) {
      console.error("Failed to sync currentLocation to checkout state:", err);
    }
  }, [currentLocation]);

  const handleSelectAddress = useCallback((addr) => {
    if (!addr) return;

    const isCurrent = addr.type === 'current' || addr.id === CURRENT_LOC_CARD_ID;
    const fullAddress =
      formatFullAddress(addr) ||
      addr.address ||
      currentLocation?.name ||
      '';

    const newLoc = {
      name: fullAddress || (isCurrent ? currentLocation?.name : '') || 'Select delivery location',
      time: '12-15 mins',
      city: addr.city || currentLocation?.city || 'Indore',
      state: addr.state || currentLocation?.state || 'Madhya Pradesh',
      pincode: addr.zipCode || addr.pincode || currentLocation?.pincode || '452018',
      latitude: addr.location?.lat ?? currentLocation?.latitude,
      longitude: addr.location?.lng ?? currentLocation?.longitude,
      type: isCurrent ? 'current' : 'saved',
      selectedAddressId: isCurrent ? CURRENT_LOC_CARD_ID : (addr.id || null),
      street: addr.street || '',
      additionalDetails: addr.additionalDetails || '',
      formattedAddress: fullAddress,
    };

    updateLocation(newLoc, { persist: true });

    try {
      const stored = localStorage.getItem(CHECKOUT_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : {};

      const nextAddress = {
        id: isCurrent ? CURRENT_LOC_CARD_ID : addr.id,
        type: isCurrent ? 'Current Location' : (addr.label || 'Other'),
        name: addr.name || parsed.currentAddress?.name || '',
        address: fullAddress,
        city: addr.city || parsed.currentAddress?.city || 'Indore',
        phone: addr.phone || parsed.currentAddress?.phone || '',
        landmark: '',
        location: addr.location
          ? { lat: addr.location.lat, lng: addr.location.lng }
          : (Number.isFinite(newLoc.latitude) && Number.isFinite(newLoc.longitude)
            ? { lat: newLoc.latitude, lng: newLoc.longitude }
            : undefined),
      };

      localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify({
        ...parsed,
        currentAddress: nextAddress
      }));
    } catch (err) {
      console.error('Failed to update checkout state in localStorage:', err);
    }

    showToast(`Delivery location set to ${getDisplayAddressLabel(addr.label) || 'selected address'}`, 'success');
  }, [currentLocation, updateLocation, showToast]);

  const handleSelectAddressByLabel = useCallback((label) => {
    const target = normalizeChipLabel(label);
    const matched = (savedAddresses || []).find(
      (addr) =>
        addr.type !== 'current' &&
        normalizeChipLabel(addr.label) === target,
    );
    if (!matched) return;
    setActiveTab(label);
    handleSelectAddress(matched);
  }, [savedAddresses, handleSelectAddress]);

  const profileSavedAddresses = useMemo(
    () => (savedAddresses || []).filter((addr) => addr.type !== 'current' && addr.label !== 'Current Location'),
    [savedAddresses],
  );

  const isUsingGps = isGpsCurrentLocation(currentLocation);
  const deliveryAddressText = useMemo(() => {
    if (isUsingGps) {
      return formatFullAddress(currentLocation) || currentLocation?.formattedAddress || currentLocation?.name || '';
    }
    return formatFullAddress(currentLocation) || currentLocation?.name || '';
  }, [currentLocation, isUsingGps]);

  const hasDeliveryAddress = Boolean(deliveryAddressText && deliveryAddressText !== 'Select delivery location');

  const addressCards = useMemo(() => {
    const cards = [];
    const hasCoords =
      Number.isFinite(currentLocation?.latitude) &&
      Number.isFinite(currentLocation?.longitude);

    if (isUsingGps) {
      cards.push({
        id: CURRENT_LOC_CARD_ID,
        label: 'Current Location',
        address: deliveryAddressText || formatFullAddress(currentLocation) || 'Current location',
        type: 'current',
        location: hasCoords
          ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
          : null,
        city: currentLocation?.city || '',
        state: currentLocation?.state || '',
        zipCode: currentLocation?.pincode || '',
        formattedAddress: deliveryAddressText,
      });
    }

    cards.push(...profileSavedAddresses);
    return cards;
  }, [isUsingGps, currentLocation, deliveryAddressText, profileSavedAddresses]);

  // Auto-detect which saved address is currently active
  useEffect(() => {
    if (!profileSavedAddresses.length || isUsingGps) return;
    const matching = profileSavedAddresses.find(
      (addr) =>
        String(addr.id) === String(currentLocation?.selectedAddressId) ||
        addr.address === currentLocation?.name ||
        addr.formattedAddress === currentLocation?.name,
    );
    if (matching) {
      setActiveTab(matching.label === 'Office' ? 'Work' : getDisplayAddressLabel(matching.label));
    }
  }, [profileSavedAddresses, currentLocation, isUsingGps]);

  // â”€â”€ Stable handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleRemove = useCallback(
    (item) => {
      removeFromCart(item.id || item._id);
      showToast(`${item.name} removed from cart`, 'info');
    },
    [removeFromCart, showToast],
  );

  const handleApplyCoupon = useCallback(async (coupon) => {
    try {
      const res = await customerApi.validateCoupon({
        code: coupon.code,
        cartTotal,
        items: cart,
        customerId: user?._id,
        couponSource: coupon.isSellerCoupon ? 'seller' : undefined,
      });
      if (res?.data?.success) {
        const nextCoupon = {
          ...coupon,
          ...res.data.result,
          discountType: res.data.result?.discountType || coupon.discountType,
          discountValue: res.data.result?.discountValue ?? coupon.discountValue,
          maxDiscount: res.data.result?.maxDiscount ?? coupon.maxDiscount,
          minOrderValue: res.data.result?.minOrderValue ?? coupon.minOrderValue,
          title: res.data.result?.title || coupon.title || formatCouponDiscountLabel(coupon),
        };
        setSelectedCoupon(nextCoupon);
        showToast(`Coupon ${coupon.code} applied!`, 'success');
      } else {
        showToast(res?.data?.message || 'Unable to apply coupon', 'error');
      }
    } catch (error) {
      showToast(error?.response?.data?.message || 'Unable to apply coupon', 'error');
    }
  }, [cartTotal, cart, user?._id, showToast]);

  const handleRemoveCoupon = useCallback(() => {
    setSelectedCoupon(null);
    showToast('Coupon removed', 'info');
  }, [showToast]);

  const handleClearAll = useCallback(async () => {
    setShowClearConfirm(false);
    setSelectedCoupon(null);
    await clearCart();
    showToast('Cart cleared', 'info');
  }, [clearCart, showToast]);

  const handleBack = useCallback(() => {
    if (window.history.state && window.history.state.idx > 0) { navigate(-1); return; }
    navigate(categoriesPath);
  }, [navigate, categoriesPath]);

  const openClearConfirm = useCallback(() => setShowClearConfirm(true), []);
  const closeClearConfirm = useCallback(() => setShowClearConfirm(false), []);

  // âœ… FIX: LocationDrawer close hone pe addresses refresh karo
  const handleLocationDrawerClose = useCallback(() => {
    setIsLocationOpen(false);
    // Drawer band hote hi saved addresses reload karo taaki cart mein naya address dikhe
    refreshAddresses?.();
  }, [refreshAddresses]);

  // â”€â”€ Loading / empty states â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (loading && cart.length === 0) {
    return (
      <div className="min-h-screen bg-[#f7f7f7] dark:bg-background px-4 py-6">
        <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-2xl bg-white dark:bg-card px-6 py-16 text-center shadow-sm border border-slate-100 dark:border-white/10">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 dark:border-white/10 border-t-rose-600" />
          <h2 className="mt-5 text-base font-medium text-slate-900 dark:text-slate-100">Loading your cart</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Pulling in your saved items...</p>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-[#f7f7f7] dark:bg-background px-4 py-6">
        <div className="mx-auto max-w-md">
          <div className="mb-5 flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-card text-slate-700 dark:text-slate-200 shadow-sm border border-slate-100 dark:border-white/10"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-base font-medium text-slate-900 dark:text-slate-100">Your Cart</h1>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Add items to get started</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-card px-6 py-10 text-center shadow-sm border border-slate-100 dark:border-white/10">
            <div className="mx-auto mb-6 flex h-44 w-44 items-center justify-center">
              <Lottie animationData={emptyBoxAnimation} loop className="h-40 w-40" />
            </div>
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">Your cart is empty</h2>
            <p className="mt-3 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
              Pick a few essentials and they&apos;ll show up here.
            </p>
            <Link to={categoriesPath} className="mt-6 inline-flex w-full">
              <Button className="h-11 w-full rounded-xl bg-rose-600/90 text-white font-medium hover:bg-rose-700">
                Start Shopping
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // â”€â”€ Main render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="min-h-screen bg-[#f8f7f6] dark:bg-background pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-3xl px-3 py-2.5 md:px-4 md:py-4">

        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleBack}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white dark:bg-card text-slate-600 dark:text-slate-200 shadow-sm border border-slate-100 dark:border-white/10"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-[15px] font-semibold text-slate-800 dark:text-slate-100 tracking-tight">Your Cart</h1>
              <p className="text-[12px] font-medium tabular-nums text-slate-500 dark:text-slate-400">{itemCount} item{itemCount === 1 ? '' : 's'}</p>
            </div>
          </div>
          <button
            onClick={openClearConfirm}
            className="text-[12px] font-medium text-rose-600/90 dark:text-rose-400 transition-colors hover:text-rose-700 dark:hover:text-rose-300"
          >
            Clear all
          </button>
        </div>

        {/* Clear cart confirmation modal */}
        {showClearConfirm && (
          <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={closeClearConfirm}
            />
            <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white dark:bg-card p-5 shadow-2xl border border-slate-100 dark:border-white/10">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-500/15 mx-auto">
                <Trash2 size={20} className="text-rose-600 dark:text-rose-400" />
              </div>
              <h3 className="text-center text-sm font-medium text-slate-800 dark:text-slate-100">Clear your cart?</h3>
              <p className="mt-2 text-center text-[13px] font-medium text-slate-500 dark:text-slate-400">
                All {itemCount} item{itemCount === 1 ? '' : 's'} will be removed. This can&apos;t be undone.
              </p>
              <div className="mt-5 flex gap-2.5">
                <button
                  onClick={closeClearConfirm}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 py-2.5 text-[13px] font-medium text-slate-600 dark:text-slate-300 transition-colors hover:border-slate-300 dark:hover:border-white/20"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAll}
                  className="flex-1 rounded-xl bg-rose-600/90 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-rose-700"
                >
                  Clear all
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delivery Banner */}
        <section className="mb-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-500/10 p-2.5 shadow-sm border border-rose-100/60 dark:border-rose-500/20">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-rose-700/80 dark:text-rose-300">
                Delivery in 10 minutes
              </p>
              <h2 className="mt-0.5 text-[13px] font-medium text-slate-800 dark:text-slate-100">
                Shipment from your nearby store
              </h2>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Fast doorstep delivery with live seller-side processing.
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-card text-rose-600 dark:text-rose-400 shadow-sm">
              <Timer size={16} />
            </div>
          </div>
        </section>

        {/* Delivery Address Section — matches Food cart address card */}
        <section className="mb-3 rounded-xl bg-white dark:bg-card px-3 py-3.5 shadow-sm border border-slate-100 dark:border-white/10">
          <div className="flex items-start justify-between w-full text-left">
            <div className="flex items-start gap-4 flex-1">
              <div className="bg-rose-50 dark:bg-rose-500/15 p-2 rounded-xl mt-0.5">
                <MapPin className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col">
                  <p className="text-[13px] md:text-sm font-medium text-gray-800 dark:text-slate-100">
                    Delivery at{' '}
                    <span className="font-medium">
                      {isUsingGps ? 'Current location' : 'Location'}
                    </span>
                  </p>

                  {isUsingGps ? (
                    <div className="mt-1">
                      {isFetchingLocation ? (
                        <p className="text-[11px] md:text-xs font-medium text-gray-500 dark:text-slate-400 animate-pulse">
                          Finding your current address...
                        </p>
                      ) : (
                        <p className="text-[11px] md:text-xs font-medium text-gray-500 dark:text-slate-400 line-clamp-2">
                          {deliveryAddressText || 'Add delivery address'}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-500/25">
                          GPS enabled
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[12px] font-medium text-gray-500 dark:text-slate-400 mt-1 line-clamp-2 pr-4">
                      {hasDeliveryAddress ? deliveryAddressText : 'Add delivery address'}
                    </p>
                  )}
                </div>

                {!hasDeliveryAddress && (
                  <p className="text-[12px] text-rose-600 dark:text-rose-400 mt-2 font-medium">
                    Select a delivery location to continue
                  </p>
                )}

                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {['Home', 'Work', 'Other'].map((label) => {
                    const normalizedLabel = normalizeChipLabel(label);
                    const addressExists = profileSavedAddresses.some(
                      (addr) => normalizeChipLabel(addr.label) === normalizedLabel,
                    );
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSelectAddressByLabel(label);
                        }}
                        disabled={!addressExists}
                        className={`text-[11px] px-3 py-1 rounded-full font-medium transition-all ${
                          addressExists
                            ? 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/15'
                            : 'bg-gray-50 dark:bg-white/5 text-gray-400 dark:text-slate-500 border border-gray-100 dark:border-white/10 cursor-not-allowed'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {addressCards.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {addressCards.map((address) => {
                      const isSelected = isUsingGps
                        ? address.id === CURRENT_LOC_CARD_ID
                        : String(currentLocation?.selectedAddressId || '') === String(address.id) ||
                          (!currentLocation?.selectedAddressId &&
                            (address.address === currentLocation?.name ||
                              address.formattedAddress === currentLocation?.name ||
                              formatFullAddress(address) === currentLocation?.name));

                      return (
                        <button
                          key={address.id || `${address.label}-${address.address}`}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActiveTab(
                              address.label === 'Office' || address.label === 'Work'
                                ? 'Work'
                                : address.label === 'Current Location'
                                  ? 'Home'
                                  : getDisplayAddressLabel(address.label),
                            );
                            handleSelectAddress(address);
                          }}
                          className={`w-full text-left rounded-xl border p-2.5 transition-colors ${
                            isSelected
                              ? 'border-rose-300 dark:border-rose-500/40 bg-rose-50/60 dark:bg-rose-500/10'
                              : 'border-slate-100 dark:border-white/10 hover:border-slate-200 dark:hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-gray-900 dark:text-slate-100">
                                {getDisplayAddressLabel(address.label)}
                              </p>
                              <p className="text-[11px] font-medium text-gray-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                                {formatFullAddress(address) || address.address || 'Address details'}
                              </p>
                            </div>
                            {isSelected && (
                              <span className="text-[10px] bg-rose-600/90 text-white px-2 py-0.5 rounded font-medium tracking-wide whitespace-nowrap">
                                Selected
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsLocationOpen(true)}
              className="p-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/15 rounded-full hover:bg-rose-100 dark:hover:bg-rose-500/25 transition-colors shrink-0"
              aria-label="Open location selector"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </section>

        {/* Cart Items — each item is memoized */}
        <div className="space-y-2">
          {cart.map((item) => (
            <CartItem
              key={item.id || item._id}
              item={item}
              onRemove={handleRemove}
              onUpdateQuantity={updateQuantity}
              showToast={showToast}
            />
          ))}
        </div>

        {/* Available Coupons */}
        <section className="mt-3 rounded-xl bg-white dark:bg-card p-3 shadow-sm border border-slate-100 dark:border-white/10">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400">
              <Tag size={15} />
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Offers</p>
              <h2 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">Available Coupons</h2>
            </div>
          </div>

          {isCouponsLoading ? (
            <p className="text-[12px] font-medium text-slate-400 dark:text-slate-500">Loading coupons...</p>
          ) : coupons.length === 0 ? (
            <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
              No coupons available for this order right now.
            </p>
          ) : (
            <div className="space-y-2">
              {coupons.map((coupon) => (
                <CartCouponRow
                  key={coupon.code || coupon._id || coupon.id}
                  coupon={coupon}
                  cartSubtotal={cartTotal}
                  isApplied={selectedCoupon?.code === coupon.code}
                  onApply={handleApplyCoupon}
                  onRemove={handleRemoveCoupon}
                />
              ))}
            </div>
          )}
        </section>

        {/* Bill Details */}
        <section className="mt-3 rounded-xl bg-white dark:bg-card p-3 shadow-sm border border-slate-100 dark:border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Bill details</p>
              <h2 className="mt-0.5 text-[13px] font-semibold text-slate-800 dark:text-slate-100">Price breakdown</h2>
            </div>
            <span className="rounded-full bg-rose-50 dark:bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-rose-700 dark:text-rose-300">
              {itemCount} item{itemCount === 1 ? '' : 's'}
            </span>
          </div>

          <div className="mt-3 space-y-2 text-[13px] font-medium text-slate-600 dark:text-slate-400">
            {[
              ['Items total', billSubtotal],
              ['Delivery fee', effectiveDeliveryFee],
              ['Platform fee', platformFee],
              ...(handlingFee > 0 ? [['Handling fee', handlingFee]] : []),
              ...(packagingFee > 0 ? [['Packing Fee', packagingFee]] : []),
              ['GST', gstAmount],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between">
                <span>{label}</span>
                <span className="font-medium tabular-nums tracking-normal text-slate-800 dark:text-slate-100">
                  {label === 'Delivery fee' && isFreeDeliveryCoupon ? (
                    <span className="text-rose-600 dark:text-rose-400">FREE</span>
                  ) : (
                    `₹${value}`
                  )}
                </span>
              </div>
            ))}
            {selectedCoupon && (
              <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                <span>
                  Coupon ({selectedCoupon.code}
                  {couponDiscountLabel ? ` Â· ${couponDiscountLabel}` : ''})
                </span>
                <span className="font-medium tabular-nums">
                  {isFreeDeliveryCoupon ? 'Free delivery' : `-₹${discountAmount}`}
                </span>
              </div>
            )}
            {isPricingLoading && (!hasServerPricing || !serverCouponAligned) ? (
              <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">Updating bill from server...</p>
            ) : null}
            <div className="border-t border-dashed border-slate-200 dark:border-white/10 pt-2.5">
              <div className="flex items-center justify-between text-[14px] font-semibold text-slate-800 dark:text-slate-100">
                <span>To pay</span>
                <span className="tabular-nums tracking-normal">₹{grandTotal}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Payment Selection */}
        <section className="mt-3 rounded-xl bg-white dark:bg-card p-3 shadow-sm border border-slate-100 dark:border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Payment</p>
              <h2 className="mt-0.5 text-[13px] font-semibold text-slate-800 dark:text-slate-100">Choose how you want to pay</h2>
              <p className="mt-1 text-[12px] leading-5 font-medium text-slate-500 dark:text-slate-400">
                We&apos;ll carry this choice into checkout so you don&apos;t have to pick it again.
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {isCodBlockedByOrderValue && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-[12px] font-medium text-amber-800 dark:text-amber-200">
                {codBlockedMessage}
              </div>
            )}
            {paymentMethods.length ? (
              paymentMethods.map((method) => {
                const Icon = method.icon;
                const isSelected = selectedPayment === method.id;
                const isDisabled = Boolean(method.disabled);
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => !isDisabled && setSelectedPayment(method.id)}
                    disabled={isDisabled}
                    className={`flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all ${isDisabled
                      ? 'border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5 opacity-60 cursor-not-allowed'
                      : isSelected
                      ? 'border-rose-300 dark:border-rose-500/40 bg-rose-50/70 dark:bg-rose-500/10'
                      : 'border-slate-200 dark:border-white/10 bg-white dark:bg-card hover:border-slate-300 dark:hover:border-white/20'
                      }`}
                  >
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full ${isSelected ? 'bg-rose-100 dark:bg-rose-500/20' : 'bg-slate-100 dark:bg-white/10'}`}>
                      <Icon size={16} className={isSelected ? 'text-rose-700 dark:text-rose-300' : 'text-slate-600 dark:text-slate-400'} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] font-medium ${isSelected ? 'text-rose-800 dark:text-rose-200' : 'text-slate-800 dark:text-slate-100'}`}>
                        {method.label}
                      </p>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{method.sublabel}</p>
                    </div>
                    <div className={`flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 ${isSelected ? 'border-rose-600 dark:border-rose-400 bg-rose-600 dark:bg-rose-500' : 'border-slate-300 dark:border-white/20'}`}>
                      {isSelected && <Check size={10} className="text-white" />}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2.5 text-[13px] font-medium text-slate-500 dark:text-slate-400">
                Payment options are currently unavailable. You can still review the order on checkout.
              </div>
            )}
          </div>
        </section>

        {/* Checkout Card */}
        <Link to={checkoutPath} state={{ selectedPayment }} className="block mt-3">
          <section className="rounded-xl bg-white dark:bg-card p-3 shadow-sm border border-slate-100 dark:border-white/10 transition-all hover:shadow-md active:scale-[0.99]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Checkout</p>
                <h2 className="mt-0.5 text-[13px] font-medium text-slate-800 dark:text-slate-100">
                  Address, payment and seller confirmation
                </h2>
                <p className="mt-1 text-[12px] leading-5 font-medium text-slate-500 dark:text-slate-400">
                  Review delivery details on the next screen and place the order.
                </p>
              </div>
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400">
                <ChevronRight size={16} />
              </div>
            </div>
          </section>
        </Link>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-[520] border-t border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-card/95 backdrop-blur-md px-3 pt-2 pb-[calc(0.65rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(15,23,42,0.08)] dark:shadow-[0_-8px_24px_rgba(0,0,0,0.35)]">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">To pay</p>
            <p className="truncate text-[16px] font-semibold tabular-nums tracking-normal text-slate-800 dark:text-slate-100">₹{grandTotal}</p>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
              {selectedPaymentMethod ? selectedPaymentMethod.label : 'Includes delivery charges'}
            </p>
          </div>

          <Link
            to={checkoutPath}
            state={{ selectedPayment }}
            className="shrink-0"
          >
            <Button className="h-10 rounded-xl bg-rose-600/90 px-4 text-[13px] font-medium text-white hover:bg-rose-700">
              <ShoppingBag size={15} className="mr-1.5" />
              Checkout
            </Button>
          </Link>
        </div>
      </div>

      {/* âœ… FIX: onClose mein refreshAddresses call ho raha hai */}
      <LocationDrawer
        isOpen={isLocationOpen}
        onClose={handleLocationDrawerClose}
      />
    </div>
  );
};

export default CartPage;