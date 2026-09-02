import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@core/context/AuthContext";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CreditCard,
  FileBadge2,
  Loader2,
  MapPin,
  ShieldCheck,
  Store,
  Upload,
  LogOut,
  Clock,
  Calendar as CalendarIcon,
  X,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@food/components/ui/popover";
import { Calendar } from "@food/components/ui/calendar";
import { format } from "date-fns";
import { toast } from "sonner";
import { useCompanyName } from "@food/hooks/useCompanyName";
import { getAppLogo, subscribeBusinessSettings } from "@common/utils/businessSettings";
import { sellerApi } from "../services/sellerApi";
import { formatTimeAMPM } from "../../../shared/utils/timeFormat";
import {
  clearSellerOnboardingDraft,
  consumeSellerOnboardingDiscarded,
  draftMatchesSellerPhone,
  markSellerOnboardingDiscarded,
  normalizeSellerDraftPhone,
  readSellerOnboardingDraft,
  writeSellerOnboardingDraft,
} from "../utils/onboardingDraft";
import { markSellerOnboardingResume } from "../utils/sellerSession";
import { useSellerBackGuard } from "../hooks/useSellerBackGuard";
import { scrollRegistrationToTop } from "../utils/scrollRegistrationToTop";
import { isPointInZone } from "@shared/utils/pointInZone";
const envGoogleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
import { onboardingFeeAPI } from "../../../services/api";
import { initRazorpayPayment } from "@food/utils/razorpay";
import MapPicker from "@shared/components/MapPicker";
import loginBg from "@food/assets/loginbanner.png";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@food/components/ui/select";
import OnboardingLocationSection from "@food/components/restaurant/OnboardingLocationSection";

const ONBOARDING_INPUT =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium transition-all outline-none focus:border-[#e71d28] focus:ring-1 focus:ring-[#e71d28] hover:border-slate-300";

const initialState = {
  name: "",
  shopName: "",
  email: "",
  phone: "",
  zoneId: "",
  zoneSource: "",
  zoneName: "",
  address: "",
  lat: "",
  lng: "",
  businessType: "Quick Commerce",
  alternatePhone: "",
  supportEmail: "",
  openingHours: "",
  bankName: "",
  accountHolderName: "",
  accountNumber: "",
  ifscCode: "",
  accountType: "",
  upiId: "",
  panNumber: "",
  gstRegistered: false,
  gstNumber: "",
  gstLegalName: "",
  fssaiNumber: "",
  fssaiExpiry: "",
  shopLicenseNumber: "",
  shopLicenseExpiry: "",
  fssaiImage: "",
  shopLicenseImage: "",
  upiQrImage: "",
  shopImage: "",
};

const parseOpeningHours = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return { openingTime: "", closingTime: "" };
  }

  const match = raw.match(/(\d{1,2}:\d{2})(?::\d{2})?\s*(?:-|to)\s*(\d{1,2}:\d{2})(?::\d{2})?/i);
  if (match) {
    return {
      openingTime: match[1].padStart(5, "0"),
      closingTime: match[2].padStart(5, "0"),
    };
  }

  return { openingTime: "", closingTime: "" };
};

const buildOpeningHoursLabel = (openingTime, closingTime) => {
  if (!openingTime || !closingTime) return "";
  return `${formatTimeAMPM(openingTime)} - ${formatTimeAMPM(closingTime)}`;
};

const timeOptions = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  const minutes = index % 2 === 0 ? "00" : "30";
  const value = `${hours}:${minutes}`;
  return { value, label: formatTimeAMPM(value) };
});

const normalizeTimeValue = (value) => {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
};

const getSellerPhone = (seller = {}) => normalizeSellerDraftPhone(seller.phone || "");

const sanitizePhoneField = (value = "") => normalizeSellerDraftPhone(value);

/** Keep the first 10 digits while typing. Only strip 0/91 prefixes on paste. */
const sanitizePhoneInput = (value = "") => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length <= 10) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits.slice(0, 10);
};

const PAN_NUMBER_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GST_NUMBER_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GST_LEGAL_NAME_REGEX = /^[A-Za-z][A-Za-z\s]{1,}$/;
const FSSAI_NUMBER_REGEX = /^\d{14}$/;
const SHOP_LICENSE_REGEX = /^[A-Za-z0-9/-]{5,20}$/;
const ACCOUNT_NUMBER_REGEX = /^\d{9,18}$/;

const formatPickedDate = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const ImageUploadField = ({
  label,
  required = false,
  imageUrl,
  uploading = false,
  emptyText,
  onSelect,
}) => (
  <div className="flex flex-col gap-1.5 md:col-span-2">
    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
      {label} {required ? <span className="text-[#e71d28]">*</span> : null}
    </label>
    {imageUrl ? (
      <img
        src={imageUrl}
        alt={label}
        className="mt-1 h-36 w-full max-w-sm rounded-xl border border-slate-200 object-cover"
      />
    ) : null}
    <label
      className={`mt-1 flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3 text-sm font-medium text-slate-700 transition-colors ${
        uploading
          ? "border-amber-300 bg-amber-50"
          : "border-slate-300 bg-slate-50 hover:bg-slate-100"
      }`}
    >
      <span className="truncate max-w-[220px]">
        {uploading ? "Uploading…" : imageUrl ? "Image saved — tap to replace" : emptyText}
      </span>
      <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#fde8ea] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#c41922]">
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {uploading ? "Wait" : "Choose"}
      </span>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        disabled={uploading}
        onChange={onSelect}
      />
    </label>
  </div>
);

const OnboardingDatePicker = ({
  value,
  onChange,
  placeholder = "Select date",
  error = false,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`${ONBOARDING_INPUT} flex items-center justify-start text-left font-normal ${
            !value ? "text-slate-500" : "text-slate-900"
          } ${error ? "border-[#ee6169] bg-[#fef4f4]" : ""}`}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {value ? format(new Date(value), "PPP") : <span>{placeholder}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-[100]" align="start">
        <Calendar
          mode="single"
          selected={value ? new Date(value) : undefined}
          onSelect={(date) => {
            if (!date) return;
            onChange(formatPickedDate(date));
            setOpen(false);
          }}
          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
};

const applySellerSessionUpgrade = (response) => {
  const accessToken = response?.data?.accessToken;
  if (!accessToken) return;
  localStorage.setItem("auth_seller", accessToken);
  window.dispatchEvent(new Event("sellerAuthChanged"));
};

const isBlankValue = (value) =>
  value === undefined ||
  value === null ||
  value === "" ||
  (Array.isArray(value) && value.length === 0);

const toDateInputValue = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? String(value).slice(0, 10)
    : parsed.toISOString().slice(0, 10);
};

const DATE_FIELDS = ["fssaiExpiry", "shopLicenseExpiry"];
const IMAGE_FIELDS = [
  "fssaiImage",
  "shopLicenseImage",
  "upiQrImage",
  "shopImage",
];

const imageUrlsFromProfile = (saved = {}) => ({
  fssaiImage: saved.documents?.fssaiImage || saved.fssaiImage || "",
  shopLicenseImage:
    saved.documents?.shopLicenseImage || saved.shopLicenseImage || "",
  upiQrImage: saved.bankInfo?.upiQrImage || saved.upiQrImage || "",
  shopImage: saved.shopInfo?.shopImage || saved.shopImage || "",
});

const isSystemPlaceholderEmail = (email = "") =>
  String(email).toLowerCase().includes("@seller.local");

const isSystemPlaceholderName = (name = "") =>
  /^Seller(\s+\d+)?$/i.test(String(name || "").trim());

const isSystemPlaceholderShopName = (shopName = "") =>
  /^Store(\s+\d+)?$/i.test(String(shopName || "").trim());

const stripSystemPlaceholders = (fields = {}) => {
  const next = { ...fields };
  if (isSystemPlaceholderName(next.name)) next.name = "";
  if (isSystemPlaceholderShopName(next.shopName)) next.shopName = "";
  if (isSystemPlaceholderEmail(next.email)) next.email = "";
  return next;
};

const mergeSavedProfileIntoForm = (current, saved = {}) => {
  const merged = { ...current };
  const cleanedSaved = stripSystemPlaceholders(saved);

  Object.keys(initialState).forEach((key) => {
    if (!isBlankValue(merged[key])) return;

    const savedValue = DATE_FIELDS.includes(key)
      ? toDateInputValue(cleanedSaved[key])
      : cleanedSaved[key];
    if (isBlankValue(savedValue)) return;

    merged[key] = key === "phone" || key === "alternatePhone"
      ? sanitizePhoneField(savedValue)
      : savedValue;
  });

  const images = imageUrlsFromProfile(cleanedSaved);
  IMAGE_FIELDS.forEach((key) => {
    if (isBlankValue(merged[key]) && !isBlankValue(images[key])) {
      merged[key] = images[key];
    }
  });

  return merged;
};

export default function SellerOnboarding() {
  const navigate = useNavigate();
  const companyName = useCompanyName();
  const [logoUrl, setLogoUrl] = useState(() => getAppLogo('seller') || getAppLogo() || '');

  useEffect(() => {
    const apply = () => {
      const logo = getAppLogo('seller') || getAppLogo();
      if (logo) setLogoUrl(logo);
    };
    apply();
    return subscribeBusinessSettings(apply);
  }, []);

  const { user, refreshUser, logout } = useAuth();
  const [form, setForm] = useState(initialState);
  const [qrFile, setQrFile] = useState(null);
  const [licenseFile, setLicenseFile] = useState(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [zones, setZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [isSavingHours, setIsSavingHours] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hoursDraft, setHoursDraft] = useState({ openingTime: "", closingTime: "" });
  const [feeConfig, setFeeConfig] = useState(undefined);
  const [fetchingFees, setFetchingFees] = useState(false);
  const [rejectionReason, setRejectionReason] = useState(null);
  const [isReonboardBypass, setIsReonboardBypass] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isQuitting, setIsQuitting] = useState(false);
  const [stepServerError, setStepServerError] = useState("");
  const [fssaiFile, setFssaiFile] = useState(null);
  const [uploadingImageKey, setUploadingImageKey] = useState(null);
  const stepRef = useRef(currentStep);
  const quitOpenRef = useRef(false);
  const mapOpenRef = useRef(false);
  const gstSectionRef = useRef(null);

  stepRef.current = currentStep;
  quitOpenRef.current = showQuitModal;
  mapOpenRef.current = isMapOpen;

  useEffect(() => {
    const fetchFees = async () => {
      try {
        setFetchingFees(true);
        const res = await onboardingFeeAPI.getPublicFees();
        const fees = res?.data?.data || res?.data;
        if (fees && fees.SELLER) {
          setFeeConfig(fees.SELLER);
        }
      } catch (err) {
        console.error("Failed to fetch public onboarding fee for seller:", err);
      } finally {
        setFetchingFees(false);
      }
    };
    fetchFees();
  }, []);

  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        phone: getSellerPhone(user) || sanitizePhoneField(prev.phone),
        alternatePhone: sanitizePhoneField(prev.alternatePhone),
      }));
    }
  }, [user]);

  useEffect(() => {
    if (isLoading) return;
    const phone = form.phone || user?.phone || "";
    if (!normalizeSellerDraftPhone(phone)) return;
    writeSellerOnboardingDraft({
      phone,
      form: stripSystemPlaceholders(form),
      step: currentStep,
    });
    markSellerOnboardingResume();
  }, [form, currentStep, isLoading, user?.phone]);

  useEffect(() => {
    const loadProfile = async () => {
      const sellerToken = localStorage.getItem("auth_seller");
      if (!sellerToken) {
        setIsLoading(false);
        navigate("/seller/auth", { replace: true });
        return;
      }

      try {
        const response = await sellerApi.getProfile();
        const data = response?.data?.result || {};
        const sellerPhone = getSellerPhone(data) || getSellerPhone(user) || "";
        if (consumeSellerOnboardingDiscarded(sellerPhone)) {
          clearSellerOnboardingDraft();
          setForm({ ...initialState, phone: sellerPhone });
          setCurrentStep(1);
          setHoursDraft({ openingTime: "", closingTime: "" });
          setIsLoading(false);
          return;
        }
        const storedDraft = readSellerOnboardingDraft();
        const useDraft = draftMatchesSellerPhone(storedDraft, sellerPhone);

        if (storedDraft && !useDraft) {
          clearSellerOnboardingDraft();
        }

        const savedProfile = {
          ...data,
          ...(data.documents || {}),
          ...(data.shopInfo || {}),
          ...(data.bankInfo || {}),
          address: data.address || data.location?.formattedAddress || data.location?.address || "",
          lat: data.location?.latitude ?? "",
          lng: data.location?.longitude ?? "",
        };

        const draftForm = useDraft
          ? stripSystemPlaceholders(storedDraft.form || {})
          : {};
        const baseForm = {
          ...initialState,
          ...draftForm,
          phone: sanitizePhoneField(draftForm.phone),
          alternatePhone: sanitizePhoneField(draftForm.alternatePhone),
        };
        const mergedForm = mergeSavedProfileIntoForm(baseForm, savedProfile);

        setForm({
          ...mergedForm,
          phone: sellerPhone || sanitizePhoneField(mergedForm.phone),
          alternatePhone: sanitizePhoneField(mergedForm.alternatePhone),
        });

        if (useDraft) {
          const savedStep = Number(storedDraft?.step);
          if (Number.isFinite(savedStep) && savedStep >= 1 && savedStep <= 4) {
            setCurrentStep(savedStep);
          }
        } else {
          setCurrentStep(1);
        }

        setHoursDraft(
          parseOpeningHours(
            data?.shopInfo?.openingHours ||
              data?.openingHours ||
              (useDraft ? storedDraft?.form?.openingHours : "") ||
              "",
          ),
        );

        if (sessionStorage.getItem("sellerReonboard") === "true" || data?.approvalStatus === "rejected") {
          setRejectionReason(data.approvalNotes || data.rejectionReason || "Your previous application was rejected. Please update your details.");
          setIsReonboardBypass(true);
        } else if (data?.approvalStatus === "pending" || data?.approvalStatus === "approved" || data?.onboardingSubmitted) {
          setIsReonboardBypass(true);
        }
      } catch (error) {
        toast.error("Failed to load seller profile details");
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [navigate, user]);

  useEffect(() => {
    let isMounted = true;
    const loadZones = async () => {
      setZonesLoading(true);
      try {
        const response = await sellerApi.getPublicZones();
        const payload = response?.data?.result || response?.data?.data || response?.data || {};
        const rawItems = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.zones)
            ? payload.zones
            : [];

        const formatted = rawItems.map((z) => ({
          ...z,
          _id: String(z._id || z.id || ""),
          id: String(z._id || z.id || ""),
          name: z.name || z.zoneName || z.serviceLocation || "Zone",
          label: z.name || z.zoneName || z.serviceLocation || "Zone",
          coordinates: Array.isArray(z.coordinates)
            ? z.coordinates.map((c) => ({
                latitude: Number(c?.latitude ?? c?.lat),
                longitude: Number(c?.longitude ?? c?.lng),
                lat: Number(c?.latitude ?? c?.lat),
                lng: Number(c?.longitude ?? c?.lng),
              }))
            : [],
        }));

        if (!isMounted) return;
        setZones(formatted);
      } catch (error) {
        console.error("Failed to load seller zones:", error);
        if (!isMounted) return;
        setZones([]);
      } finally {
        if (isMounted) setZonesLoading(false);
      }
    };

    loadZones();
    return () => {
      isMounted = false;
    };
  }, []);

  const selectedZone = useMemo(
    () =>
      zones.find(
        (zone) =>
          String(zone?._id || zone?.id || "") === String(form.zoneId || ""),
      ) || null,
    [form.zoneId, zones],
  );

  const mapLocationProp = useMemo(() => {
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    const hasCoords = !Number.isNaN(lat) && !Number.isNaN(lng) && lat !== 0 && lng !== 0;

    return {
      coordinates: hasCoords ? [lng, lat] : null,
      address: form.address || "",
      formattedAddress: form.address || "",
    };
  }, [form.lat, form.lng, form.address]);

  const updateField = (field, value) => {
    setStepServerError("");
    setForm((prev) => {
      if (field === "gstRegistered" && value !== true) {
        return {
          ...prev,
          gstRegistered: false,
          gstNumber: "",
          gstLegalName: "",
        };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleZoneChange = (value) => {
    const matched = zones.find(
      (zone) => String(zone._id || zone.id || "") === String(value),
    );
    if (!matched) {
      setForm((prev) => ({
        ...prev,
        zoneId: "",
        zoneSource: "",
        zoneName: "",
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      zoneId: String(matched._id || matched.id),
      zoneSource: matched.source || "quick",
      zoneName: matched.name || matched.label || "",
    }));
  };

  const handleLocationChange = (locationData) => {
    if (!locationData) return;

    const lat = locationData.coordinates?.[1] || locationData.latitude;
    const lng = locationData.coordinates?.[0] || locationData.longitude;
    const address = locationData.formattedAddress || locationData.address || "";

    if (
      selectedZone?.coordinates?.length >= 3 &&
      lat &&
      lng &&
      !isPointInZone(lat, lng, selectedZone.coordinates)
    ) {
      toast.error(
        `Selected location is outside ${selectedZone.label}. Please select a location inside this service zone.`,
      );
      return;
    }

    setForm((prev) => ({
      ...prev,
      lat: lat ? String(lat) : prev.lat,
      lng: lng ? String(lng) : prev.lng,
      address: address || prev.address,
    }));
  };

  const handleOpeningHoursChange = (key, value) => {
    const nextDraft = {
      ...hoursDraft,
      [key]: normalizeTimeValue(value),
    };
    setHoursDraft(nextDraft);

    if (nextDraft.openingTime && nextDraft.closingTime) {
      updateField(
        "openingHours",
        `${nextDraft.openingTime} - ${nextDraft.closingTime}`,
      );
    }
  };

  const handleSaveOpeningHours = async () => {
    if (!hoursDraft.openingTime || !hoursDraft.closingTime) {
      toast.error("Please pick both opening time and closing time");
      return;
    }

    setIsSavingHours(true);
    const value = `${hoursDraft.openingTime} - ${hoursDraft.closingTime}`;
    try {
      await sellerApi.updateProfile({ openingHours: value });
      updateField("openingHours", value);
      toast.success("Opening hours saved");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save opening hours");
    } finally {
      setIsSavingHours(false);
    }
  };

  const openingHoursPreview = useMemo(() => {
    const fromDraft = buildOpeningHoursLabel(
      hoursDraft.openingTime,
      hoursDraft.closingTime,
    );
    if (fromDraft) return fromDraft;

    const parsed = parseOpeningHours(form.openingHours);
    const fromForm = buildOpeningHoursLabel(parsed.openingTime, parsed.closingTime);
    return fromForm || "Not set";
  }, [form.openingHours, hoursDraft.openingTime, hoursDraft.closingTime]);

  const handleImageSelect = async (fieldKey, file, clearLocalFile) => {
    if (!file) {
      clearLocalFile(null);
      return;
    }

    clearLocalFile(file);
    setUploadingImageKey(fieldKey);
    try {
      const payload = new FormData();
      payload.append(fieldKey, file);
      const response = await sellerApi.updateProfile(payload);
      const imageUrls = imageUrlsFromProfile(response?.data?.result || {});
      const uploadedUrl = imageUrls[fieldKey];
      if (!uploadedUrl) {
        throw new Error("Image uploaded but URL was not returned");
      }
      setForm((prev) => ({ ...prev, [fieldKey]: uploadedUrl }));
      clearLocalFile(null);
      toast.success("Image saved");
    } catch (error) {
      toast.error(
        error?.response?.data?.message || error?.message || "Failed to upload image",
      );
    } finally {
      setUploadingImageKey(null);
    }
  };

  const persistStepOrThrow = async (payload) => {
    setStepServerError("");
    await sellerApi.updateProfile(payload);
  };

  const handleNextStep = async () => {
    if (uploadingImageKey) {
      toast.error("Please wait for the image upload to finish");
      return;
    }

    // Step 1: Store Details
    if (currentStep === 1) {
      if (!form.name || !form.shopName || !form.email) {
        toast.error("Please fill in seller name, shop name, and email");
        return;
      }
      if (form.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.email)) {
        toast.error("Enter a valid email address");
        return;
      }
      if (form.supportEmail && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.supportEmail)) {
        toast.error("Enter a valid support email address");
        return;
      }
      if (!form.zoneId) {
        toast.error("Please select a service zone");
        return;
      }
      if (!form.shopImage) {
        toast.error("Please upload a shop photo");
        return;
      }
      if (!form.lat || !form.lng || !form.address) {
        toast.error("Please search or pin your store location on the map");
        return;
      }
      if (
        selectedZone?.coordinates?.length >= 3 &&
        !isPointInZone(form.lat, form.lng, selectedZone.coordinates)
      ) {
        toast.error(
          `Store location must be inside ${selectedZone.label}. Pin your shop within the selected zone.`,
        );
        return;
      }
      const primaryPhone = sanitizePhoneField(form.phone);
      const alternatePhone = sanitizePhoneField(form.alternatePhone);
      if (!alternatePhone || alternatePhone.length !== 10) {
        toast.error("Enter a valid 10-digit alternate mobile number");
        return;
      }
      if (!["6", "7", "8", "9"].includes(alternatePhone[0])) {
        toast.error("Enter a valid Indian alternate mobile number");
        return;
      }
      if (alternatePhone === primaryPhone) {
        toast.error("Alternate phone cannot be same as primary");
        return;
      }
      try {
        setIsAdvancing(true);
        await persistStepOrThrow({
          name: form.name,
          shopName: form.shopName,
          email: form.email,
          alternatePhone,
          supportEmail: form.supportEmail,
          zoneId: form.zoneId,
          zoneSource: form.zoneSource,
          zoneName: form.zoneName || selectedZone?.label || "",
          address: form.address,
          lat: form.lat,
          lng: form.lng,
          shopImage: form.shopImage,
          businessType: "Quick Commerce",
        });
        setCurrentStep(2);
      } catch (error) {
        const message =
          error?.response?.data?.message ||
          error?.message ||
          "Please fix the details on this page";
        setStepServerError(message);
        toast.error(message);
      } finally {
        setIsAdvancing(false);
      }
    } 
    // Step 2: Business Hours
    else if (currentStep === 2) {
      if (!hoursDraft.openingTime || !hoursDraft.closingTime) {
        toast.error("Please pick both opening time and closing time");
        return;
      }
      const value = `${hoursDraft.openingTime} - ${hoursDraft.closingTime}`;
      try {
        setIsAdvancing(true);
        await persistStepOrThrow({ openingHours: value });
        updateField("openingHours", value);
        setCurrentStep(3);
      } catch (error) {
        toast.error(error?.response?.data?.message || "Failed to save opening hours");
      } finally {
        setIsAdvancing(false);
      }
    } 
    // Step 3: Documents & Compliance
    else if (currentStep === 3) {
      const today = new Date().toISOString().split("T")[0];

      if (!form.panNumber?.trim()) {
        toast.error("PAN number is required");
        return;
      }
      if (!PAN_NUMBER_REGEX.test(form.panNumber)) {
        toast.error("Invalid PAN format");
        return;
      }

      if (form.gstRegistered) {
        if (!form.gstNumber?.trim()) {
          toast.error("GST number is required");
          return;
        }
        if (!GST_NUMBER_REGEX.test(form.gstNumber)) {
          toast.error("Invalid GST format");
          return;
        }
        if (!form.gstLegalName?.trim()) {
          toast.error("GST legal name is required");
          return;
        }
        if (!GST_LEGAL_NAME_REGEX.test(form.gstLegalName.trim())) {
          toast.error("GST legal name must contain only letters");
          return;
        }
      }

      if (!form.fssaiNumber?.trim()) {
        toast.error("FSSAI number is required");
        return;
      }
      if (!FSSAI_NUMBER_REGEX.test(form.fssaiNumber)) {
        toast.error("FSSAI number must be exactly 14 digits");
        return;
      }
      if (!form.fssaiExpiry) {
        toast.error("FSSAI expiry date is required");
        return;
      }
      if (form.fssaiExpiry < today) {
        toast.error("FSSAI expiry cannot be a past date");
        return;
      }
      if (!fssaiFile && !form.fssaiImage) {
        toast.error("FSSAI Image is required");
        return;
      }

      if (!form.shopLicenseNumber?.trim()) {
        toast.error("Shop license number is required");
        return;
      }
      if (!SHOP_LICENSE_REGEX.test(form.shopLicenseNumber)) {
        toast.error("Invalid shop license number");
        return;
      }
      if (!form.shopLicenseExpiry) {
        toast.error("Shop license expiry date is required");
        return;
      }
      if (form.shopLicenseExpiry < today) {
        toast.error("Shop license expiry cannot be a past date");
        return;
      }
      if (!licenseFile && !form.shopLicenseImage) {
        toast.error("Shop license image is required");
        return;
      }

      try {
        setIsAdvancing(true);
        await persistStepOrThrow({
          panNumber: form.panNumber,
          gstRegistered: Boolean(form.gstRegistered),
          gstNumber: form.gstRegistered ? form.gstNumber : "",
          gstLegalName: form.gstRegistered ? form.gstLegalName : "",
          fssaiNumber: form.fssaiNumber,
          fssaiExpiry: form.fssaiExpiry,
          fssaiImage: form.fssaiImage,
          shopLicenseNumber: form.shopLicenseNumber,
          shopLicenseExpiry: form.shopLicenseExpiry,
          shopLicenseImage: form.shopLicenseImage,
        });
        setCurrentStep(4);
      } catch (error) {
        toast.error(
          error?.response?.data?.message ||
            error?.message ||
            "Please fix the details on this page",
        );
      } finally {
        setIsAdvancing(false);
      }
    }
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const openQuitModal = () => {
    setShowQuitModal(true);
  };

  const stayOnRegistration = () => {
    setShowQuitModal(false);
  };

  const quitRegistration = async () => {
    if (isQuitting) return;
    setIsQuitting(true);
    const phone = form.phone || user?.phone || "";
    markSellerOnboardingDiscarded(phone);
    clearSellerOnboardingDraft();
    try {
      await logout({ keepSellerOnboardingDraft: false });
    } finally {
      setIsQuitting(false);
      setShowQuitModal(false);
      navigate("/seller/auth", { replace: true });
    }
  };

  useSellerBackGuard(() => {
    if (mapOpenRef.current) {
      setIsMapOpen(false);
      return;
    }
    if (quitOpenRef.current) {
      setShowQuitModal(false);
      return;
    }
    if (stepRef.current > 1) {
      setCurrentStep((prev) => Math.max(1, prev - 1));
      return;
    }
    setShowQuitModal(true);
  });

  useLayoutEffect(() => {
    scrollRegistrationToTop();
  }, [currentStep]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (uploadingImageKey) {
      toast.error("Please wait for the image upload to finish");
      return;
    }

    if (!form.bankName || !form.accountHolderName || !form.accountNumber || !form.ifscCode || !form.accountType) {
      toast.error("Please fill in all banking fields");
      return;
    }
    if (!ACCOUNT_NUMBER_REGEX.test(form.accountNumber)) {
      toast.error("Invalid account number");
      return;
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode)) {
      toast.error("Invalid IFSC code");
      return;
    }
    if (form.upiId && !/^[\w.-]+@[\w.-]+$/.test(form.upiId)) {
      toast.error("Invalid UPI ID format (e.g. name@okhdfcbank)");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Check Onboarding Fee
      if (feeConfig?.enabled && !feeConfig?.waived && !isReonboardBypass) {
        const orderRes = await onboardingFeeAPI.createOrder({
          role: "SELLER",
          name: form.name,
          email: form.email,
          phone: form.phone,
        });

        const orderData = orderRes?.data?.data || orderRes?.data;
        if (!orderData || !orderData.orderId) {
          throw new Error("Failed to initialize registration payment order");
        }

        await new Promise((resolve, reject) => {
          initRazorpayPayment({
            orderId: orderData.orderId,
            amount: orderData.amount,
            currency: orderData.currency || "INR",
            key: orderData.key,
            name: `${companyName || "Store"} Onboarding Fee`,
            description: "Seller Account Activation Fee",
            prefill: {
              name: form.name,
              email: form.email,
              contact: form.phone,
            },
            onSuccess: resolve,
            onDismiss: () => reject(new Error("Payment was cancelled. Please complete payment to submit registration.")),
          });
        });
      }

      // 2. Submit Full Profile
      const payload = new FormData();
      Object.keys(form).forEach((key) => {
        if (["fssaiImage", "shopLicenseImage", "upiQrImage", "shopImage"].includes(key)) return;
        payload.append(key, form[key]);
      });
      payload.append("submitForApproval", "true");

      const response = await sellerApi.updateProfile(payload);
      applySellerSessionUpgrade(response);
      clearSellerOnboardingDraft();
      sessionStorage.removeItem("sellerReonboard");
      toast.success("Application submitted successfully!");
      if (refreshUser) refreshUser();
      navigate("/seller/pending", { replace: true });
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to submit application");
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepTitles = [
    "Store Details",
    "Business Hours",
    "Documents",
    "Bank & UPI",
  ];

  const brandInitial = companyName ? companyName.charAt(0).toUpperCase() : "I";

  return (
    <div className="relative min-h-screen bg-[#F8FAFC]">
      <div id="seller-onboarding-page" className="app-shell-page fixed inset-0 z-30 flex min-h-0 min-w-0 flex-col overflow-hidden overscroll-none bg-[#F8FAFC] font-inter seller-theme-scope lg:left-[420px] xl:left-[460px]">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-[420px] flex-col xl:w-[460px] lg:flex">
          <img
            src={loginBg}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#F97316]/95 via-[#c41922]/95 to-[#C2410C]/95" />
          <div className="relative z-10 flex h-full flex-col overflow-hidden p-8 xl:p-10">
            <div className="shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm overflow-hidden p-1.5 shadow-inner">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={companyName || "Itzo"}
                      className="h-full w-full object-contain filter drop-shadow-sm"
                    />
                  ) : (
                    <span className="text-xl font-black text-white">{brandInitial}</span>
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">
                    Partner Onboarding
                  </p>
                  <p className="text-xl font-black text-white font-jakarta">{companyName || "Itzo"}</p>
                </div>
              </div>
              <div className="mt-6 rounded-2xl border border-white/20 bg-white/15 p-5 backdrop-blur-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-white/80">Current step</p>
                <p className="mt-1 text-xl font-black text-white font-jakarta">
                  {stepTitles[currentStep - 1]}
                </p>
              </div>
            </div>
            
            <div className="mt-6 shrink-0 px-1">
              <div className="mb-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">Onboarding Progress</p>
                <div className="mt-2 text-2xl font-black text-white">{currentStep * 25}%</div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/20">
                  <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${currentStep * 25}%` }} />
                </div>
              </div>
              
              <div className="mt-8 space-y-6">
                {[
                  { step: 1, title: "Store Details" },
                  { step: 2, title: "Business Hours" },
                  { step: 3, title: "Documents" },
                  { step: 4, title: "Bank & UPI" },
                ].map((s) => (
                  <div key={s.step} className="flex items-start gap-4">
                    <div className="relative flex flex-col items-center">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shadow-sm transition-all duration-300 ${currentStep === s.step ? "bg-white text-[#c41922] scale-110" : currentStep > s.step ? "bg-white/20 text-white backdrop-blur-sm border border-white/30" : "bg-black/10 text-white/40 border border-white/10"}`}>
                        {currentStep > s.step ? <Check className="h-4 w-4" /> : s.step}
                      </div>
                      {s.step !== 4 && <div className={`absolute top-8 bottom-[-24px] w-px ${currentStep > s.step ? "bg-white/40" : "bg-white/10"}`} />}
                    </div>
                    <div className="pt-1.5">
                      <p className={`text-sm font-bold transition-colors ${currentStep === s.step ? "text-white" : currentStep > s.step ? "text-white/90" : "text-white/40"}`}>{s.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile top bar */}
        <header className="app-shell-page__header z-50 shrink-0 border-b border-slate-100 bg-white pt-[env(safe-area-inset-top)] shadow-sm lg:hidden">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 px-3 pt-3 pb-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => (currentStep > 1 ? handlePrevStep() : openQuitModal())}
                disabled={isSubmitting || Boolean(uploadingImageKey)}
                className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-900 transition-colors hover:bg-slate-100 disabled:opacity-50"
                aria-label="Go back"
              >
                <ArrowLeft className="h-6 w-6" strokeWidth={2.4} />
              </button>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-slate-900 tracking-wide font-jakarta">Seller Onboarding</p>
                <p className="truncate text-[11px] font-medium text-slate-500">
                  {stepTitles[currentStep - 1]}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openQuitModal}
              disabled={isSubmitting || Boolean(uploadingImageKey)}
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-[#fef4f4] hover:text-[#c41922] focus-visible:outline-none"
              title="Exit registration"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
          <div className="px-4 pb-3 sm:px-6">
            <div className="flex items-center justify-between gap-1 mb-2">
              {[1, 2, 3, 4].map((stepNumber) => (
                <div key={stepNumber} className="flex-1 flex items-center">
                  <div className={`h-1.5 w-full rounded-full transition-all duration-300 ${currentStep >= stepNumber ? "bg-[#e71d28]" : "bg-slate-200"}`} />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-1">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#c41922]">
                  STEP {currentStep} OF 4
                </p>
                <h2 className="text-[13px] font-bold text-slate-900 mt-0.5 font-jakarta">
                  {stepTitles[currentStep - 1]}
                </h2>
              </div>
              <div className="rounded-full bg-[#fde8ea] px-2.5 py-1 text-[10px] font-bold text-[#c41922]">
                {currentStep * 25}%
              </div>
            </div>
          </div>
        </header>

        {/* Desktop top bar */}
        <header className="hidden shrink-0 items-center justify-between border-b border-slate-100 bg-white px-8 py-5 lg:flex xl:px-10">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
                Step {currentStep} of 4
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 font-jakarta">
                {stepTitles[currentStep - 1]}
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
             <button
               type="button"
               onClick={openQuitModal}
               className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-[#fef4f4] hover:text-[#c41922] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e71d28]/30"
               title="Exit registration"
             >
               <LogOut className="h-5 w-5" />
             </button>
          </div>
        </header>

        <main id="onboarding-main-scroll" className="app-shell-page__body min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4 sm:p-6 lg:p-8 xl:p-10 [-webkit-overflow-scrolling:touch]">
          <div className="mx-auto w-full max-w-3xl">
          {rejectionReason && (
            <div className="mb-6 rounded-[16px] border border-[#f9c7c9] bg-[#fef4f4] px-5 py-4 flex items-start gap-3 shadow-sm">
              <div className="mt-0.5 shrink-0 rounded-full bg-[#fde8ea] p-2 text-[#c41922]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86C20.47 19 21.5 17.56 20.79 16.13L13.93 3.93a2 2 0 00-3.86 0L2.21 16.13C1.5 17.56 2.53 19 4.07 19z" /></svg>
              </div>
              <div>
                <p className="text-sm font-bold text-[#5c0c10]">Previous Application Rejected</p>
                <p className="mt-1 text-sm font-medium text-[#7f1016]">{rejectionReason}</p>
                <p className="mt-2 text-xs font-semibold text-[#c41922]">Please update your details below and resubmit.</p>
              </div>
            </div>
          )}

          <motion.form
            key={currentStep}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className="space-y-6 pb-12"
          >
            {/* Step 1: Store Details */}
            {currentStep === 1 && (
            <section className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-[0_2px_12px_rgba(15,23,42,0.03)] space-y-5">
              <div>
                <h2 className="text-lg font-jakarta font-bold text-slate-900">
                  Store Details
                </h2>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  How your seller account will appear to customers and admin.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Seller name <span className="text-[#e71d28]">*</span></label>
                  <input required className={ONBOARDING_INPUT} placeholder="Seller name" value={form.name} onChange={(e) => updateField("name", e.target.value.replace(/[^a-zA-Z\s]/g, ""))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Shop name <span className="text-[#e71d28]">*</span></label>
                  <input required className={ONBOARDING_INPUT} placeholder="Shop name" value={form.shopName} onChange={(e) => updateField("shopName", e.target.value.replace(/[^a-zA-Z\s]/g, ""))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email <span className="text-[#e71d28]">*</span></label>
                  <input
                    required
                    className={`rounded-xl border bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-slate-900 focus:bg-white transition-colors ${form.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.email) ? "border-[#ee6169] bg-[#fef4f4]" : "border-slate-200"}`}
                    placeholder="Email (e.g. name@domain.com)"
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                  />
                  {form.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.email) && (
                    <p className="text-xs font-semibold text-[#c41922] px-1">Enter a valid email address (e.g. name@domain.com)</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Primary phone <span className="text-[#e71d28]">*</span></label>
                  <input className={`${ONBOARDING_INPUT} bg-slate-100 text-slate-500`} placeholder="Primary phone" value={form.phone} readOnly title="Linked from the seller OTP login" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Alternate phone <span className="text-[#e71d28]">*</span></label>
                  <input
                    required
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    className={`${ONBOARDING_INPUT} ${
                      form.alternatePhone &&
                      (sanitizePhoneField(form.alternatePhone) === sanitizePhoneField(form.phone) ||
                        sanitizePhoneField(form.alternatePhone).length !== 10 ||
                        !["6", "7", "8", "9"].includes(sanitizePhoneField(form.alternatePhone)[0] || ""))
                        ? "border-[#ee6169] bg-[#fef4f4]"
                        : "border-slate-200"
                    }`}
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    value={form.alternatePhone}
                    onChange={(e) => updateField("alternatePhone", sanitizePhoneInput(e.target.value))}
                    onBlur={(e) => updateField("alternatePhone", sanitizePhoneInput(e.target.value))}
                  />
                  {form.alternatePhone && sanitizePhoneField(form.alternatePhone) === sanitizePhoneField(form.phone) && (
                    <p className="text-xs font-semibold text-[#c41922] px-1">Alternate number cannot be same as primary number</p>
                  )}
                  {form.alternatePhone &&
                    sanitizePhoneField(form.alternatePhone) !== sanitizePhoneField(form.phone) &&
                    (sanitizePhoneField(form.alternatePhone).length !== 10 ||
                      !["6", "7", "8", "9"].includes(sanitizePhoneField(form.alternatePhone)[0] || "")) && (
                    <p className="text-xs font-semibold text-[#c41922] px-1">Enter a valid 10-digit Indian mobile number (without country code)</p>
                  )}
                  {stepServerError ? (
                    <p className="text-xs font-semibold text-[#c41922] px-1">{stepServerError}</p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Support email <span className="text-[#e71d28]">*</span></label>
                  <input
                    required
                    className={`${ONBOARDING_INPUT} ${form.supportEmail && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.supportEmail) ? "border-[#ee6169] bg-[#fef4f4] ring-[#f9c7c9]" : ""}`}
                    placeholder="Support email (e.g. support@example.com)"
                    type="email"
                    value={form.supportEmail}
                    onChange={(e) => updateField("supportEmail", e.target.value)}
                  />
                  {form.supportEmail && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.supportEmail) && (
                    <p className="text-xs font-semibold text-[#c41922] px-1">Enter a valid email address (e.g. support@example.com)</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <p className="mb-1 text-xs font-medium text-slate-500">Upload a clear photo of your storefront — this appears on your seller profile.</p>
                  <ImageUploadField
                    label="Shop photo"
                    required
                    imageUrl={form.shopImage}
                    uploading={uploadingImageKey === "shopImage"}
                    emptyText="Upload shop photo"
                    onSelect={(e) =>
                      handleImageSelect("shopImage", e.target.files?.[0], () => {})
                    }
                  />
                </div>

                <div className="md:col-span-2 mt-4 space-y-4">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Store location</p>
                    <p className="mt-0.5 text-xs font-medium text-slate-500">Add your store location for order pick-up and deliveries.</p>
                  </div>
                  <OnboardingLocationSection
                    zoneId={form.zoneId}
                    zones={zones}
                    zonesLoading={zonesLoading}
                    isEditing={true}
                    location={mapLocationProp}
                    onZoneChange={handleZoneChange}
                    onLocationChange={handleLocationChange}
                    zoneError={""}
                    locationError={""}
                  />
                </div>
              </div>
            </section>
            )}

            {/* Step 2: Business Hours */}
            {currentStep === 2 && (
            <section className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-[0_2px_12px_rgba(15,23,42,0.03)] space-y-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-jakarta font-bold text-slate-900">Business Hours</h2>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">Select your daily opening and closing time.</p>
                </div>
                <span className="rounded-full bg-[#fef4f4] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#c41922] border border-[#fde8ea]">
                  {openingHoursPreview}
                </span>
              </div>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Opens at <span className="text-[#e71d28]">*</span></span>
                  <Select
                    value={hoursDraft.openingTime || undefined}
                    onValueChange={(val) => handleOpeningHoursChange("openingTime", val)}
                  >
                    <SelectTrigger className={`${ONBOARDING_INPUT} !h-11`}>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                        <SelectValue placeholder="Select opening time" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {timeOptions.map((time) => (
                        <SelectItem key={time.value} value={time.value}>
                          {time.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Closes at <span className="text-[#e71d28]">*</span></span>
                  <Select
                    value={hoursDraft.closingTime || undefined}
                    onValueChange={(val) => handleOpeningHoursChange("closingTime", val)}
                  >
                    <SelectTrigger className={`${ONBOARDING_INPUT} !h-11`}>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                        <SelectValue placeholder="Select closing time" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {timeOptions.map((time) => (
                        <SelectItem key={time.value} value={time.value}>
                          {time.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveOpeningHours}
                  disabled={isSavingHours}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#e71d28] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-[#c41922] disabled:cursor-not-allowed disabled:opacity-70 shadow-sm"
                >
                  {isSavingHours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {isSavingHours ? "Saving..." : "Save Hours"}
                </button>
              </div>
            </section>
            )}

            {/* Step 3: Documents & Compliance */}
            {currentStep === 3 && (
            <section className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-[0_2px_12px_rgba(15,23,42,0.03)] space-y-5">
              <div>
                <h2 className="text-lg font-jakarta font-bold text-slate-900">
                  Compliance and Documents
                </h2>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  Submit government-issued business registrations and licenses.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">PAN number <span className="text-[#e71d28]">*</span></label>
                  <input
                    required
                    className={`${ONBOARDING_INPUT} uppercase ${form.panNumber && !PAN_NUMBER_REGEX.test(form.panNumber) ? "border-[#ee6169] bg-[#fef4f4] ring-[#f9c7c9]" : ""}`}
                    placeholder="PAN (e.g. ABCDE1234F)"
                    value={form.panNumber}
                    maxLength={10}
                    onChange={(e) => updateField("panNumber", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))}
                  />
                  {form.panNumber && !PAN_NUMBER_REGEX.test(form.panNumber) && (
                    <p className="text-xs font-semibold text-[#c41922] px-1">Invalid PAN: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)</p>
                  )}
                </div>

                <div className="flex flex-col justify-center gap-1.5">
                  <label className="flex items-center gap-3 cursor-pointer pt-4">
                    <input
                      type="checkbox"
                      checked={Boolean(form.gstRegistered)}
                      onChange={(e) => {
                        updateField("gstRegistered", e.target.checked);
                        if (e.target.checked) {
                          setTimeout(() => {
                            gstSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                          }, 100);
                        }
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-[#c41922] focus:ring-[#e71d28]"
                    />
                    <span className="text-xs font-bold text-slate-700">Business is GST registered</span>
                  </label>
                </div>

                {form.gstRegistered && (
                  <div ref={gstSectionRef} className="contents">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">GST number <span className="text-[#e71d28]">*</span></label>
                      <input
                        required
                        className={`${ONBOARDING_INPUT} uppercase ${form.gstNumber && !GST_NUMBER_REGEX.test(form.gstNumber) ? "border-[#ee6169] bg-[#fef4f4] ring-[#f9c7c9]" : ""}`}
                        placeholder="GST number (15 alphanumeric)"
                        value={form.gstNumber}
                        maxLength={15}
                        onChange={(e) => updateField("gstNumber", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15))}
                      />
                      {form.gstNumber && !GST_NUMBER_REGEX.test(form.gstNumber) && (
                        <p className="text-xs font-semibold text-[#c41922] px-1">Invalid GST format (15 characters alphanumeric)</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">GST legal name <span className="text-[#e71d28]">*</span></label>
                      <input
                        required
                        className={`${ONBOARDING_INPUT} ${form.gstLegalName && !GST_LEGAL_NAME_REGEX.test(form.gstLegalName) ? "border-[#ee6169] bg-[#fef4f4] ring-[#f9c7c9]" : ""}`}
                        placeholder="Legal entity name on GST"
                        value={form.gstLegalName}
                        onChange={(e) => updateField("gstLegalName", e.target.value.replace(/[^a-zA-Z\s]/g, ""))}
                      />
                      {form.gstLegalName && !GST_LEGAL_NAME_REGEX.test(form.gstLegalName) && (
                        <p className="text-xs font-semibold text-[#c41922] px-1">GST legal name must contain only letters</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">FSSAI registration number <span className="text-[#e71d28]">*</span></label>
                  <input
                    required
                    className={`${ONBOARDING_INPUT} ${form.fssaiNumber && !FSSAI_NUMBER_REGEX.test(form.fssaiNumber) ? "border-[#ee6169] bg-[#fef4f4] ring-[#f9c7c9]" : ""}`}
                    placeholder="FSSAI number (14 digits)"
                    value={form.fssaiNumber}
                    maxLength={14}
                    onChange={(e) => updateField("fssaiNumber", e.target.value.replace(/\D/g, "").slice(0, 14))}
                  />
                  {form.fssaiNumber && !FSSAI_NUMBER_REGEX.test(form.fssaiNumber) && (
                    <p className="text-xs font-semibold text-[#c41922] px-1">FSSAI number must be exactly 14 digits</p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">FSSAI expiry date <span className="text-[#e71d28]">*</span></label>
                  <OnboardingDatePicker
                    value={form.fssaiExpiry}
                    onChange={(val) => updateField("fssaiExpiry", val)}
                    placeholder="Select FSSAI expiry"
                    error={Boolean(form.fssaiExpiry && form.fssaiExpiry < new Date().toISOString().split("T")[0])}
                  />
                </div>

                <ImageUploadField
                  label="FSSAI document image"
                  required
                  imageUrl={form.fssaiImage}
                  uploading={uploadingImageKey === "fssaiImage"}
                  emptyText="Upload FSSAI certificate"
                  onSelect={(e) =>
                    handleImageSelect("fssaiImage", e.target.files?.[0], setFssaiFile)
                  }
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Shop license number <span className="text-[#e71d28]">*</span></label>
                  <input
                    required
                    className={`${ONBOARDING_INPUT} ${form.shopLicenseNumber && !SHOP_LICENSE_REGEX.test(form.shopLicenseNumber) ? "border-[#ee6169] bg-[#fef4f4] ring-[#f9c7c9]" : ""}`}
                    placeholder="Shop & Establishment license"
                    value={form.shopLicenseNumber}
                    onChange={(e) => updateField("shopLicenseNumber", e.target.value.replace(/[^a-zA-Z0-9/-]/g, ""))}
                  />
                  {form.shopLicenseNumber && !SHOP_LICENSE_REGEX.test(form.shopLicenseNumber) && (
                    <p className="text-xs font-semibold text-[#c41922] px-1">Shop license must be 5–20 characters</p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">License expiry date <span className="text-[#e71d28]">*</span></label>
                  <OnboardingDatePicker
                    value={form.shopLicenseExpiry}
                    onChange={(val) => updateField("shopLicenseExpiry", val)}
                    placeholder="Select license expiry"
                    error={Boolean(form.shopLicenseExpiry && form.shopLicenseExpiry < new Date().toISOString().split("T")[0])}
                  />
                </div>

                <ImageUploadField
                  label="Shop license image"
                  required
                  imageUrl={form.shopLicenseImage}
                  uploading={uploadingImageKey === "shopLicenseImage"}
                  emptyText="Upload shop license copy"
                  onSelect={(e) =>
                    handleImageSelect("shopLicenseImage", e.target.files?.[0], setLicenseFile)
                  }
                />
              </div>
            </section>
            )}

            {/* Step 4: Bank & UPI */}
            {currentStep === 4 && (
            <section className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-[0_2px_12px_rgba(15,23,42,0.03)] space-y-5">
              <div>
                <h2 className="text-lg font-jakarta font-bold text-slate-900">
                  Banking and UPI
                </h2>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  Add settlement bank account details for order payouts.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bank name <span className="text-[#e71d28]">*</span></label>
                  <input required className={ONBOARDING_INPUT} placeholder="Bank name" value={form.bankName} onChange={(e) => updateField("bankName", e.target.value.replace(/[^a-zA-Z\s]/g, ""))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Account holder name <span className="text-[#e71d28]">*</span></label>
                  <input required className={ONBOARDING_INPUT} placeholder="Account holder name" value={form.accountHolderName} onChange={(e) => updateField("accountHolderName", e.target.value.replace(/[^a-zA-Z\s]/g, ""))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Account number <span className="text-[#e71d28]">*</span></label>
                  <input
                    required
                    className={`${ONBOARDING_INPUT} ${form.accountNumber && !ACCOUNT_NUMBER_REGEX.test(form.accountNumber) ? "border-[#ee6169] bg-[#fef4f4] ring-[#f9c7c9]" : ""}`}
                    placeholder="Account number (9–18 digits)"
                    value={form.accountNumber}
                    maxLength={18}
                    onChange={(e) => updateField("accountNumber", e.target.value.replace(/\D/g, "").slice(0, 18))}
                  />
                  {form.accountNumber && !ACCOUNT_NUMBER_REGEX.test(form.accountNumber) && (
                    <p className="text-xs font-semibold text-[#c41922] px-1">Account number must be 9–18 digits (numbers only)</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">IFSC code <span className="text-[#e71d28]">*</span></label>
                  <input
                    required
                    className={`${ONBOARDING_INPUT} uppercase ${form.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode) ? "border-[#ee6169] bg-[#fef4f4] ring-[#f9c7c9]" : ""}`}
                    placeholder="IFSC code (e.g. ABCD0EF1234)"
                    value={form.ifscCode}
                    maxLength={11}
                    onChange={(e) => updateField("ifscCode", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11))}
                  />
                  {form.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode) && (
                    <p className="text-xs font-semibold text-[#c41922] px-1">Invalid IFSC: 4 letters + 0 + 6 alphanumeric (e.g. ABCD0EF1234)</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Account type <span className="text-[#e71d28]">*</span></label>
                  <Select
                    value={form.accountType}
                    onValueChange={(val) => updateField("accountType", val)}
                    required
                  >
                    <SelectTrigger className={ONBOARDING_INPUT}>
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Savings">Savings Account</SelectItem>
                      <SelectItem value="Current">Current Account</SelectItem>
                      <SelectItem value="Salary">Salary Account</SelectItem>
                      <SelectItem value="Fixed Deposit">Fixed Deposit Account</SelectItem>
                      <SelectItem value="Recurring Deposit">Recurring Deposit Account</SelectItem>
                      <SelectItem value="NRI">NRI Account (NRE/NRO)</SelectItem>
                      <SelectItem value="Jan Dhan">Jan Dhan Account</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">UPI ID (optional)</label>
                  <input
                    className={`${ONBOARDING_INPUT} ${form.upiId && !/^[\w.-]+@[\w.-]+$/.test(form.upiId) ? "border-[#ee6169] bg-[#fef4f4] ring-[#f9c7c9]" : ""}`}
                    placeholder="UPI ID (e.g. name@okhdfcbank)"
                    value={form.upiId}
                    onChange={(e) => updateField("upiId", e.target.value.trim().toLowerCase())}
                  />
                </div>
                <ImageUploadField
                  label="UPI QR Code (optional)"
                  imageUrl={form.upiQrImage}
                  uploading={uploadingImageKey === "upiQrImage"}
                  emptyText="Upload UPI QR Code image"
                  onSelect={(e) =>
                    handleImageSelect("upiQrImage", e.target.files?.[0], setQrFile)
                  }
                />
              </div>

              {/* Review Summary Box */}
              <div className="mt-8 rounded-2xl border border-slate-100 bg-slate-50/70 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                  <h3 className="text-sm font-bold text-slate-900">Application Summary</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Shop Name</span>
                    <span className="font-bold text-slate-800 truncate block mt-0.5">{form.shopName || "—"}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Seller Name</span>
                    <span className="font-bold text-slate-800 truncate block mt-0.5">{form.name || "—"}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Service Zone</span>
                    <span className="font-bold text-slate-800 truncate block mt-0.5">{form.zoneName || selectedZone?.label || "—"}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hours</span>
                    <span className="font-bold text-slate-800 truncate block mt-0.5">{openingHoursPreview}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">PAN</span>
                    <span className="font-bold text-slate-800 truncate block mt-0.5">{form.panNumber || "—"}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">FSSAI</span>
                    <span className="font-bold text-slate-800 truncate block mt-0.5">{form.fssaiNumber || "—"}</span>
                  </div>
                </div>
              </div>
            </section>
            )}

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between gap-4 pt-4">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  disabled={isAdvancing || isSubmitting}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Previous
                </button>
              ) : (
                <div />
              )}

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={isAdvancing || Boolean(uploadingImageKey)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#e71d28] px-6 text-sm font-bold text-white transition hover:bg-[#c41922] disabled:cursor-not-allowed disabled:opacity-70 shadow-lg shadow-[#e71d28]/20 active:scale-[0.99]"
                >
                  {isAdvancing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Next Step
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting || Boolean(uploadingImageKey)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-8 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70 shadow-lg shadow-emerald-600/20 active:scale-[0.99]"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {isSubmitting ? "Submitting Application..." : "Submit Application"}
                </button>
              )}
            </div>
          </motion.form>
          </div>
        </main>
      </div>

      {/* Quit Modal */}
      {showQuitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Exit Registration?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Your filled details will be cleared if you choose to exit and discard.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={stayOnRegistration}
                className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={quitRegistration}
                disabled={isQuitting}
                className="h-10 rounded-xl bg-[#e71d28] px-4 text-xs font-bold text-white hover:bg-[#c41922] transition shadow-sm"
              >
                {isQuitting ? "Exiting..." : "Exit & Discard"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
