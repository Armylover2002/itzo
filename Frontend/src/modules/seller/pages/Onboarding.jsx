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
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium transition-all outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 hover:border-slate-300";

const businessTypes = [
  "Quick Commerce",
];

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

const scrollOnboardingIntoView = (el) => {
  if (!el) return;
  const scroller = document.getElementById("onboarding-main-scroll");
  window.requestAnimationFrame(() => {
    if (!scroller) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const scrollerRect = scroller.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const nextTop = scroller.scrollTop + (elRect.top - scrollerRect.top) - 24;
    scroller.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
  });
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
      {label} {required ? <span className="text-red-500">*</span> : null}
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
      <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-red-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-red-600">
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
          } ${error ? "border-red-400 bg-red-50" : ""}`}
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
          setIsReonboardBypass(true); // bypass payment for re-applying
        } else if (data?.approvalStatus === "pending" || data?.approvalStatus === "approved" || data?.onboardingSubmitted) {
          setIsReonboardBypass(true); // bypass payment if already registered
        }
      } catch (error) {
        if (error?.response?.status !== 401) {
          toast.error("Failed to load seller onboarding data");
        }
        // Registration token with no seller yet: still only restore draft for this phone.
        const sellerPhone = getSellerPhone(user) || "";
        const storedDraft = readSellerOnboardingDraft();
        if (draftMatchesSellerPhone(storedDraft, sellerPhone)) {
          const draftForm = stripSystemPlaceholders(storedDraft.form || {});
          setForm({
            ...initialState,
            ...draftForm,
            phone: sellerPhone || sanitizePhoneField(draftForm.phone),
            alternatePhone: sanitizePhoneField(draftForm.alternatePhone),
          });
          const savedStep = Number(storedDraft?.step);
          if (Number.isFinite(savedStep) && savedStep >= 1 && savedStep <= 4) {
            setCurrentStep(savedStep);
          }
          setHoursDraft(parseOpeningHours(storedDraft?.form?.openingHours || ""));
        } else {
          clearSellerOnboardingDraft();
          setForm({ ...initialState, phone: sellerPhone });
          setCurrentStep(1);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, []);

  useEffect(() => {
    const loadZones = async () => {
      try {
        setZonesLoading(true);
        const quickResponse = await sellerApi.getQuickZonesPublic();
        const quickZones = Array.isArray(quickResponse?.data?.result?.zones)
          ? quickResponse.data.result.zones
          : Array.isArray(quickResponse?.data?.data?.zones)
            ? quickResponse.data.data.zones
            : [];

        setZones(
          quickZones.map((zone) => ({
            ...zone,
            source: "quick",
            label: zone?.name || zone?.zoneName || zone?.serviceLocation || "Quick Zone",
          })),
        );
      } catch (error) {
        toast.error("Failed to load service zones");
        setZones([]);
      } finally {
        setZonesLoading(false);
      }
    };

    loadZones();
  }, []);

  const completionText = useMemo(() => {
    const fields = [
      form.name,
      form.shopName,
      form.email,
      form.address,
      form.businessType,
      form.accountNumber,
      form.ifscCode,
      form.upiId,
      form.shopLicenseNumber,
    ];
    const done = fields.filter(Boolean).length;
    return `${done}/9 core fields filled`;
  }, [form]);

  const initialLocation = useMemo(
    () => (form.lat && form.lng ? { lat: Number(form.lat), lng: Number(form.lng) } : null),
    [form.lat, form.lng],
  );

  const updateField = (field, value) => {
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

  const { openingTime, closingTime } = useMemo(
    () => parseOpeningHours(form.openingHours),
    [form.openingHours],
  );


  const selectedZone = useMemo(
    () =>
      zones.find(
        (zone) =>
          String(zone?._id || zone?.id || "") === String(form.zoneId || "") &&
          String(zone?.source || "") === String(form.zoneSource || ""),
      ) || null,
    [form.zoneId, form.zoneSource, zones],
  );

  const handleOpeningHoursChange = (key, value) => {
    const normalizedValue = normalizeTimeValue(value);
    setHoursDraft((prev) => ({
      ...prev,
      [key]: normalizedValue,
    }));
  };

  const handleSaveOpeningHours = async () => {
    if (!hoursDraft.openingTime || !hoursDraft.closingTime) {
      toast.error("Select both opening and closing time first");
      return;
    }

    const openingHoursLabel = buildOpeningHoursLabel(
      hoursDraft.openingTime,
      hoursDraft.closingTime,
    );

    setIsSavingHours(true);
    try {
      updateField("openingHours", openingHoursLabel);
      await sellerApi.updateProfile({
        openingHours: openingHoursLabel,
      });
      toast.success("Opening hours saved");
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to save opening hours",
      );
    } finally {
      setIsSavingHours(false);
    }
  };

  const openingHoursPreview =
    buildOpeningHoursLabel(hoursDraft.openingTime, hoursDraft.closingTime) ||
    form.openingHours ||
    "Not set";

  const mapLocationProp = useMemo(() => ({
    formattedAddress: form.address,
    latitude: form.lat,
    longitude: form.lng
  }), [form.address, form.lat, form.lng]);

  const handleZoneChange = (zoneId) => {
    const selected = zones.find((z) => String(z._id || z.id) === String(zoneId));
    setForm((prev) => ({
      ...prev,
      zoneId: zoneId,
      zoneSource: selected?.source || "",
      zoneName: selected?.label || "",
    }));
  };

  const handleLocationChange = (locData) => {
    setForm((prev) => ({
      ...prev,
      address: locData.formattedAddress || prev.address,
      lat: locData.latitude,
      lng: locData.longitude,
    }));
  };


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
    if (currentStep === 1) {
      if (!form.businessType) {
        toast.error("Please select a business type first");
        return;
      }
      try {
        setIsAdvancing(true);
        await persistStepOrThrow({ businessType: form.businessType });
        setCurrentStep(2);
      } catch (error) {
        toast.error(error?.response?.data?.message || error?.message || "Unable to save this step");
      } finally {
        setIsAdvancing(false);
      }
    } else if (currentStep === 2) {
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
          openingHours: form.openingHours,
          businessType: form.businessType,
        });
        setCurrentStep(3);
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
    } else if (currentStep === 3) {
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
      await sellerApi.updateProfile({ resetOnboarding: true });
    } catch {
      // Local draft is already cleared; still leave registration.
    }
    setShowQuitModal(false);
    logout();
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
    if (isLoading) return;
    scrollRegistrationToTop();
    const frame = window.requestAnimationFrame(() => scrollRegistrationToTop());
    return () => window.cancelAnimationFrame(frame);
  }, [currentStep, isLoading]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const html = document.documentElement;
    const { body } = document;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (currentStep !== 4) {
      await handleNextStep();
      return;
    }

    if (form.accountNumber && !ACCOUNT_NUMBER_REGEX.test(form.accountNumber)) {
      toast.error("Account number must be 9–18 digits");
      return;
    }
    if (form.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode)) {
      toast.error("Invalid IFSC code");
      return;
    }
    if (form.upiId && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(form.upiId)) {
      toast.error("Invalid UPI ID");
      return;
    }
    if (uploadingImageKey) {
      toast.error("Please wait for the image upload to finish");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = new FormData();
      const nextForm = {
        ...form,
        zoneName: selectedZone?.label || "",
        gstRegistered: Boolean(form.gstRegistered),
        gstNumber: form.gstRegistered ? form.gstNumber : "",
        gstLegalName: form.gstRegistered ? form.gstLegalName : "",
      };
      Object.entries(nextForm).forEach(([key, value]) => {
        if (key === "radius") return;
        payload.append(
          key,
          typeof value === "boolean" ? String(value) : String(value ?? ""),
        );
      });
      payload.append("submitForApproval", "true");
      if (qrFile) payload.append("upiQrImage", qrFile);
      if (licenseFile) payload.append("shopLicenseImage", licenseFile);
      if (fssaiFile) payload.append("fssaiImage", fssaiFile);

      if (feeConfig && !isReonboardBypass && feeConfig.isActive && feeConfig.price > 0) {
        const orderRes = await onboardingFeeAPI.createOrder({
          role: "SELLER",
          name: form.name || form.shopName,
          phone: form.phone || form.alternatePhone,
          email: form.email || ""
        });
        const orderData = orderRes?.data?.data || orderRes?.data;
        
        if (!orderData || !orderData.orderId) {
          throw new Error("Failed to create onboarding payment order");
        }

        if (orderData.isMock || orderData.orderId.startsWith("mock_ord_")) {
          toast.success("Developer Mode: Payment bypassed. Submitting mock payment details.");
          payload.append("razorpayOrderId", orderData.orderId);
          payload.append("razorpayPaymentId", `mock_pay_${Date.now()}`);
          payload.append("razorpaySignature", `mock_sig_${Date.now()}`);
          
          const submitResponse = await sellerApi.updateProfile(payload);
          applySellerSessionUpgrade(submitResponse);
          clearSellerOnboardingDraft();
          await refreshUser();
          toast.success("Application submitted for admin approval");
          navigate("/seller/pending", { replace: true });
        } else {
          // Open real Razorpay modal
          setIsSubmitting(false); // Let interactive flow proceed
          const rzpOptions = {
            key: orderData.keyId,
            amount: Math.round(orderData.amount * 100),
            currency: orderData.currency || "INR",
            order_id: orderData.orderId,
            name: "Onboarding Fee Payment",
            description: `Onboarding fee for ${form.shopName}`,
            prefill: {
              name: form.name || "",
              email: form.email || "",
              contact: form.phone || ""
            },
            handler: async (response) => {
              try {
                setIsSubmitting(true);
                payload.append("razorpayOrderId", response.razorpay_order_id);
                payload.append("razorpayPaymentId", response.razorpay_payment_id);
                payload.append("razorpaySignature", response.razorpay_signature);

                const submitResponse = await sellerApi.updateProfile(payload);
                applySellerSessionUpgrade(submitResponse);
                clearSellerOnboardingDraft();
                await refreshUser();
                toast.success("Application submitted for admin approval");
                navigate("/seller/pending", { replace: true });
              } catch (error) {
                toast.error(error?.response?.data?.message || "Failed to submit onboarding");
              } finally {
                setIsSubmitting(false);
              }
            },
            onError: (err) => {
              toast.error(err?.description || "Payment failed. Please try again.");
              setIsSubmitting(false);
            },
            onClose: () => {
              toast.error("Payment modal closed. Payment is required to complete onboarding.");
              setIsSubmitting(false);
            }
          };
          await initRazorpayPayment(rzpOptions);
        }
      } else {
        const submitResponse = await sellerApi.updateProfile(payload);
        applySellerSessionUpgrade(submitResponse);
        clearSellerOnboardingDraft();
        await refreshUser();
        toast.success("Application submitted for admin approval");
        navigate("/seller/pending", { replace: true });
      }
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to submit onboarding",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f6f2]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-700" />
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;800&family=Inter:wght@400;500;600;700&display=swap');
        .font-jakarta { font-family: 'Plus Jakarta Sans', sans-serif; }
        .font-inter { font-family: 'Inter', sans-serif; }
      `}</style>
      <div id="seller-onboarding-page" className="app-shell-page fixed inset-0 z-30 flex min-h-0 min-w-0 flex-col overflow-hidden overscroll-none bg-[#F8FAFC] font-inter seller-theme-scope lg:left-[420px] xl:left-[460px]">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-[420px] flex-col xl:w-[460px] lg:flex">
          <img
            src={loginBg}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#E21A22]/95 via-[#E21A22]/90 to-[#B91C1C]/95" />
          <div className="relative z-10 flex h-full flex-col overflow-hidden p-8 xl:p-10">
            <div className="shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                  <span className="text-lg font-black text-white">B</span>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">
                    Partner Onboarding
                  </p>
                  <p className="text-lg font-black text-white">Blaze</p>
                </div>
              </div>
              <div className="mt-6 rounded-2xl border border-white/20 bg-white/15 p-5 backdrop-blur-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-white/70">Current step</p>
                <p className="mt-1 text-xl font-black text-white font-jakarta">
                  {currentStep === 1 ? "Business Profile" : currentStep === 2 ? "Store Details" : currentStep === 3 ? "Documents" : "Bank & UPI"}
                </p>
              </div>
            </div>
            
            <div className="mt-6 shrink-0 px-1">
              <div className="mb-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Onboarding Progress</p>
                <div className="mt-2 text-2xl font-black text-white">{currentStep * 25}%</div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/20">
                  <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${currentStep * 25}%` }} />
                </div>
              </div>
              
              <div className="mt-8 space-y-6">
                {[
                  { step: 1, title: "Business Profile" },
                  { step: 2, title: "Store Details" },
                  { step: 3, title: "Documents" },
                  { step: 4, title: "Bank & UPI" },
                ].map((s) => (
                  <div key={s.step} className="flex items-start gap-4">
                    <div className="relative flex flex-col items-center">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shadow-sm transition-all duration-300 ${currentStep === s.step ? "bg-white text-red-600 scale-110" : currentStep > s.step ? "bg-white/20 text-white backdrop-blur-sm border border-white/30" : "bg-black/10 text-white/40 border border-white/10"}`}>
                        {currentStep > s.step ? <Check className="h-4 w-4" /> : s.step}
                      </div>
                      {s.step !== 4 && <div className={`absolute top-8 bottom-[-24px] w-px ${currentStep > s.step ? "bg-white/40" : "bg-white/10"}`} />}
                    </div>
                    <div className="pt-1.5">
                      <p className={`text-sm font-bold transition-colors ${currentStep === s.step ? "text-white" : currentStep > s.step ? "text-white/80" : "text-white/40"}`}>{s.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile top bar (visible only on mobile) */}
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
                  {currentStep === 1 ? "Business Profile" : currentStep === 2 ? "Store Details" : currentStep === 3 ? "Documents" : "Bank & UPI"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={openQuitModal}
                className="flex h-9 w-9 items-center justify-center rounded-full text-red-500 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
                aria-label="Exit registration"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mx-auto w-full max-w-3xl border-t border-slate-100 px-4 pb-4 pt-4 sm:px-6">
            <div className="mb-5 flex items-center justify-between relative px-2 md:px-10">
              <div className="absolute top-1/2 left-8 right-8 h-[2px] -translate-y-1/2 bg-slate-100 -z-10" />
              {[1, 2, 3, 4].map((stepNumber) => (
                <div key={stepNumber} className="relative flex items-center justify-center bg-white px-1">
                  <div className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-xs font-bold shadow-sm transition-colors ${currentStep === stepNumber ? 'bg-red-600 text-white ring-4 ring-red-100' : currentStep > stepNumber ? 'bg-slate-50 text-slate-400 border-2 border-slate-200' : 'bg-white text-slate-300 border-2 border-slate-100'}`}>
                    {currentStep > stepNumber ? <Check className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400" /> : stepNumber}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-1">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-600">
                  STEP {currentStep} OF 4
                </p>
                <h2 className="text-[13px] font-bold text-slate-900 mt-0.5 font-jakarta">
                  {currentStep === 1 ? "Business Profile" : currentStep === 2 ? "Store Details" : currentStep === 3 ? "Documents" : "Bank Details"}
                </h2>
              </div>
              <div className="rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-bold text-red-600">
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
                {currentStep === 1 ? "Business Profile" : currentStep === 2 ? "Store Details" : currentStep === 3 ? "Documents" : "Bank & UPI"}
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
             <button
               type="button"
               onClick={openQuitModal}
               className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
               title="Exit registration"
             >
               <LogOut className="h-5 w-5" />
             </button>
          </div>
        </header>

        <main id="onboarding-main-scroll" className="app-shell-page__body min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4 sm:p-6 lg:p-8 xl:p-10 [-webkit-overflow-scrolling:touch]">
          <div className="mx-auto w-full max-w-3xl">
          {rejectionReason && (
            <div className="mb-6 rounded-[16px] border border-red-200 bg-red-50 px-5 py-4 flex items-start gap-3 shadow-sm">
              <div className="mt-0.5 shrink-0 rounded-full bg-red-100 p-2 text-red-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86C20.47 19 21.5 17.56 20.79 16.13L13.93 3.93a2 2 0 00-3.86 0L2.21 16.13C1.5 17.56 2.53 19 4.07 19z" /></svg>
              </div>
              <div>
                <p className="text-sm font-bold text-red-900">Previous Application Rejected</p>
                <p className="mt-1 text-sm font-medium text-red-800">{rejectionReason}</p>
                <p className="mt-2 text-xs font-semibold text-red-500">Please update your details below and resubmit.</p>
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
            {currentStep === 1 && (
            <section className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-[0_2px_12px_rgba(15,23,42,0.03)] space-y-5">
              <div>
                <h2 className="text-lg font-jakarta font-bold text-slate-900">
                  Business Profile
                </h2>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  Select your business category to begin.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Business type <span className="text-red-500">*</span></label>
                  <Select value={form.businessType} onValueChange={(val) => updateField("businessType", val)} required>
                    <SelectTrigger className={ONBOARDING_INPUT}>
                      <SelectValue placeholder="Select business type" />
                    </SelectTrigger>
                    <SelectContent>
                      {businessTypes.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <p className="text-xs font-medium text-slate-500">
                Please fill out all the details carefully before proceeding.
              </p>
            </section>
            )}

            {currentStep === 2 && (
            <section className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-[0_2px_12px_rgba(15,23,42,0.03)] space-y-5">
              <div>
                <h2 className="text-lg font-jakarta font-bold text-slate-900">
                  Store details
                </h2>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  How your seller account will appear to admin and customers.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Seller name <span className="text-red-500">*</span></label>
                  <input required className={ONBOARDING_INPUT} placeholder="Seller name" value={form.name} onChange={(e) => updateField("name", e.target.value.replace(/[^a-zA-Z\s]/g, ""))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Shop name <span className="text-red-500">*</span></label>
                  <input required className={ONBOARDING_INPUT} placeholder="Shop name" value={form.shopName} onChange={(e) => updateField("shopName", e.target.value.replace(/[^a-zA-Z\s]/g, ""))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`rounded-xl border bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-slate-900 focus:bg-white transition-colors ${form.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.email) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                    placeholder="Email (e.g. name@domain.com)"
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                  />
                  {form.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.email) && (
                    <p className="text-xs font-semibold text-red-500 px-1">Enter a valid email address (e.g. name@domain.com)</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Primary phone <span className="text-red-500">*</span></label>
                  <input className={`${ONBOARDING_INPUT} bg-slate-100 text-slate-500`} placeholder="Primary phone" value={form.phone} readOnly title="Linked from the seller OTP login" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Alternate phone <span className="text-red-500">*</span></label>
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
                        ? "border-red-400 bg-red-50"
                        : "border-slate-200"
                    }`}
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    value={form.alternatePhone}
                    onChange={(e) => updateField("alternatePhone", sanitizePhoneInput(e.target.value))}
                    onBlur={(e) => updateField("alternatePhone", sanitizePhoneInput(e.target.value))}
                  />
                  {form.alternatePhone && sanitizePhoneField(form.alternatePhone) === sanitizePhoneField(form.phone) && (
                    <p className="text-xs font-semibold text-red-500 px-1">Alternate number cannot be same as primary number</p>
                  )}
                  {form.alternatePhone &&
                    sanitizePhoneField(form.alternatePhone) !== sanitizePhoneField(form.phone) &&
                    (sanitizePhoneField(form.alternatePhone).length !== 10 ||
                      !["6", "7", "8", "9"].includes(sanitizePhoneField(form.alternatePhone)[0] || "")) && (
                    <p className="text-xs font-semibold text-red-500 px-1">Enter a valid 10-digit Indian mobile number (without country code)</p>
                  )}
                  {stepServerError ? (
                    <p className="text-xs font-semibold text-red-500 px-1">{stepServerError}</p>
                  ) : null}
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
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Support email <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`${ONBOARDING_INPUT} ${form.supportEmail && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.supportEmail) ? "border-red-400 bg-red-50 ring-red-200" : ""}`}
                    placeholder="Support email (e.g. support@example.com)"
                    type="email"
                    value={form.supportEmail}
                    onChange={(e) => updateField("supportEmail", e.target.value)}
                  />
                  {form.supportEmail && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.supportEmail) && (
                    <p className="text-xs font-semibold text-red-500 px-1">Enter a valid email address (e.g. support@example.com)</p>
                  )}
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
                
                <div className="md:col-span-2 mt-4 space-y-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">Opening hours</p>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">Select your daily opening and closing time.</p>
                    </div>
                    <span className="rounded-full bg-slate-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 border border-slate-100">
                      {openingHoursPreview}
                    </span>
                  </div>
                  <div className="grid gap-3 grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Opens at</span>
                      <Select
                        value={hoursDraft.openingTime || undefined}
                        onValueChange={(val) => handleOpeningHoursChange("openingTime", val)}
                      >
                        <SelectTrigger className={`${ONBOARDING_INPUT} !h-11`}>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                            <SelectValue placeholder="Select time" />
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
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Closes at</span>
                      <Select
                        value={hoursDraft.closingTime || undefined}
                        onValueChange={(val) => handleOpeningHoursChange("closingTime", val)}
                      >
                        <SelectTrigger className={`${ONBOARDING_INPUT} !h-11`}>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                            <SelectValue placeholder="Select time" />
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
                      className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSavingHours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      {isSavingHours ? "Saving..." : "Save Hours"}
                    </button>
                  </div>
                </div>
                
              </div>
            </section>
            )}

            {currentStep === 4 && (
            <section className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-[0_2px_12px_rgba(15,23,42,0.03)] space-y-5">
              <h2 className="text-lg font-jakarta font-bold text-slate-900">
                Banking and UPI
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bank name <span className="text-red-500">*</span></label>
                  <input required className={ONBOARDING_INPUT} placeholder="Bank name" value={form.bankName} onChange={(e) => updateField("bankName", e.target.value.replace(/[^a-zA-Z\s]/g, ""))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Account holder name <span className="text-red-500">*</span></label>
                  <input required className={ONBOARDING_INPUT} placeholder="Account holder name" value={form.accountHolderName} onChange={(e) => updateField("accountHolderName", e.target.value.replace(/[^a-zA-Z\s]/g, ""))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Account number <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`${ONBOARDING_INPUT} ${form.accountNumber && !ACCOUNT_NUMBER_REGEX.test(form.accountNumber) ? "border-red-400 bg-red-50 ring-red-200" : ""}`}
                    placeholder="Account number (9–18 digits)"
                    value={form.accountNumber}
                    maxLength={18}
                    onChange={(e) => updateField("accountNumber", e.target.value.replace(/\D/g, "").slice(0, 18))}
                  />
                  {form.accountNumber && !ACCOUNT_NUMBER_REGEX.test(form.accountNumber) && (
                    <p className="text-xs font-semibold text-red-500 px-1">Account number must be 9–18 digits (numbers only)</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">IFSC code <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`${ONBOARDING_INPUT} uppercase ${form.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode) ? "border-red-400 bg-red-50 ring-red-200" : ""}`}
                    placeholder="IFSC code (e.g. ABCD0EF1234)"
                    value={form.ifscCode}
                    maxLength={11}
                    onChange={(e) => updateField("ifscCode", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11))}
                  />
                  {form.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode) && (
                    <p className="text-xs font-semibold text-red-500 px-1">Invalid IFSC: 4 letters + 0 + 6 alphanumeric (e.g. ABCD0EF1234)</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Account type <span className="text-red-500">*</span></label>
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
                    <SelectItem value="BSBDA">Basic Savings Bank Deposit (BSBDA)</SelectItem>
                  </SelectContent>
                </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">UPI ID <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`${ONBOARDING_INPUT} ${form.upiId && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(form.upiId) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                    placeholder="UPI ID (e.g. name@okhdfcbank)"
                    value={form.upiId}
                    onChange={(e) => updateField("upiId", e.target.value)}
                  />
                  {form.upiId && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(form.upiId) && (
                    <p className="text-xs font-semibold text-red-500 px-1">Invalid UPI ID. Format: username@bankhandle (e.g. name@okhdfcbank)</p>
                  )}
                </div>
                <ImageUploadField
                  label="UPI QR image"
                  required
                  imageUrl={form.upiQrImage}
                  uploading={uploadingImageKey === "upiQrImage"}
                  emptyText="Upload UPI QR image"
                  onSelect={(e) =>
                    handleImageSelect("upiQrImage", e.target.files?.[0] || null, setQrFile)
                  }
                />
              </div>
            </section>
            )}

            {currentStep === 3 && (
            <section className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-[0_2px_12px_rgba(15,23,42,0.03)] space-y-5">
              <h2 className="text-lg font-jakarta font-bold text-slate-900">
                Compliance and license
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">PAN number <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`${ONBOARDING_INPUT} uppercase ${form.panNumber && !PAN_NUMBER_REGEX.test(form.panNumber) ? "border-red-400 bg-red-50" : ""}`}
                    placeholder="PAN number (e.g. ABCDE1234F)"
                    value={form.panNumber}
                    maxLength={10}
                    onChange={(e) => updateField("panNumber", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))}
                  />
                  {form.panNumber && !PAN_NUMBER_REGEX.test(form.panNumber) && (
                    <p className="text-xs font-semibold text-red-500 px-1">Invalid PAN format. Must be 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)</p>
                  )}
                </div>
                <label className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 md:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.gstRegistered}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      updateField("gstRegistered", checked);
                      if (checked) {
                        window.setTimeout(() => {
                          scrollOnboardingIntoView(gstSectionRef.current);
                          gstSectionRef.current?.querySelector("input")?.focus();
                        }, 80);
                      }
                    }}
                    className="h-4 w-4 accent-red-600"
                  />
                  GST registered
                </label>
                {form.gstRegistered ? (
                  <div ref={gstSectionRef} className="md:col-span-2 grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">GST number <span className="text-red-500">*</span></label>
                      <input
                        required
                        className={`${ONBOARDING_INPUT} uppercase ${form.gstNumber && !GST_NUMBER_REGEX.test(form.gstNumber) ? "border-red-400 bg-red-50" : ""}`}
                        placeholder="GST number (e.g. 22ABCDE1234F1Z5)"
                        value={form.gstNumber}
                        maxLength={15}
                        onFocus={() => scrollOnboardingIntoView(gstSectionRef.current)}
                        onChange={(e) => updateField("gstNumber", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15))}
                      />
                      {form.gstNumber && !GST_NUMBER_REGEX.test(form.gstNumber) && (
                        <p className="text-xs font-semibold text-red-500 px-1">Invalid GST format. Must be 15 chars: 2 digits + PAN (10) + entity + Z + check (e.g. 22ABCDE1234F1Z5)</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">GST legal name <span className="text-red-500">*</span></label>
                      <input
                        required
                        className={`${ONBOARDING_INPUT} ${form.gstLegalName && !GST_LEGAL_NAME_REGEX.test(form.gstLegalName.trim()) ? "border-red-400 bg-red-50" : ""}`}
                        placeholder="GST legal name"
                        value={form.gstLegalName}
                        onFocus={() => scrollOnboardingIntoView(gstSectionRef.current)}
                        onChange={(e) => updateField("gstLegalName", e.target.value.replace(/[^a-zA-Z\s]/g, ""))}
                      />
                      {form.gstLegalName && !GST_LEGAL_NAME_REGEX.test(form.gstLegalName.trim()) && (
                        <p className="text-xs font-semibold text-red-500 px-1">GST legal name must contain only letters (min. 2 characters)</p>
                      )}
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">FSSAI number <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`${ONBOARDING_INPUT} ${form.fssaiNumber && !FSSAI_NUMBER_REGEX.test(form.fssaiNumber) ? "border-red-400 bg-red-50" : ""}`}
                    placeholder="FSSAI number (14 digits)"
                    value={form.fssaiNumber}
                    maxLength={14}
                    onChange={(e) => updateField("fssaiNumber", e.target.value.replace(/\D/g, "").slice(0, 14))}
                  />
                  {form.fssaiNumber && !FSSAI_NUMBER_REGEX.test(form.fssaiNumber) && (
                    <p className="text-xs font-semibold text-red-500 px-1">FSSAI number must be exactly 14 digits (numbers only)</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">FSSAI expiry date <span className="text-red-500">*</span></label>
                  <OnboardingDatePicker
                    value={form.fssaiExpiry}
                    onChange={(next) => updateField("fssaiExpiry", next)}
                    error={Boolean(form.fssaiExpiry && form.fssaiExpiry < new Date().toISOString().split("T")[0])}
                  />
                  {form.fssaiExpiry && form.fssaiExpiry < new Date().toISOString().split("T")[0] && (
                    <p className="text-xs font-semibold text-red-500 px-1">FSSAI expiry date cannot be a past date</p>
                  )}
                </div>
                <ImageUploadField
                  label="FSSAI Image"
                  required
                  imageUrl={form.fssaiImage}
                  uploading={uploadingImageKey === "fssaiImage"}
                  emptyText="Upload FSSAI image"
                  onSelect={(e) =>
                    handleImageSelect("fssaiImage", e.target.files?.[0] || null, setFssaiFile)
                  }
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Shop license number <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`${ONBOARDING_INPUT} ${form.shopLicenseNumber && !SHOP_LICENSE_REGEX.test(form.shopLicenseNumber) ? "border-red-400 bg-red-50" : ""}`}
                    placeholder="Shop license number (e.g. MH/2023/12345)"
                    value={form.shopLicenseNumber}
                    maxLength={20}
                    onChange={(e) => updateField("shopLicenseNumber", e.target.value.replace(/[^A-Za-z0-9\/\-]/g, "").slice(0, 20))}
                  />
                  {form.shopLicenseNumber && !SHOP_LICENSE_REGEX.test(form.shopLicenseNumber) && (
                    <p className="text-xs font-semibold text-red-500 px-1">License number must be 5–20 characters (letters, numbers, / and - only)</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Shop license expiry date <span className="text-red-500">*</span></label>
                  <OnboardingDatePicker
                    value={form.shopLicenseExpiry}
                    onChange={(next) => updateField("shopLicenseExpiry", next)}
                    error={Boolean(form.shopLicenseExpiry && form.shopLicenseExpiry < new Date().toISOString().split("T")[0])}
                  />
                  {form.shopLicenseExpiry && form.shopLicenseExpiry < new Date().toISOString().split("T")[0] && (
                    <p className="text-xs font-semibold text-red-500 px-1">Shop license expiry date cannot be a past date</p>
                  )}
                </div>
                <ImageUploadField
                  label="Shop license image"
                  required
                  imageUrl={form.shopLicenseImage}
                  uploading={uploadingImageKey === "shopLicenseImage"}
                  emptyText="Upload shop license image"
                  onSelect={(e) =>
                    handleImageSelect("shopLicenseImage", e.target.files?.[0] || null, setLicenseFile)
                  }
                />
              </div>
            </section>
            )}

            {currentStep === 4 && feeConfig && !isReonboardBypass && feeConfig.isActive && feeConfig.price > 0 && (
              <div className="rounded-2xl border border-red-200 bg-red-50/70 p-5 mt-4 mb-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-red-600">
                  Required Onboarding Fee
                </p>
                <p className="mt-1.5 text-2xl font-black text-red-900">Γé╣{feeConfig.price}</p>
                <p className="mt-1.5 text-xs font-semibold text-red-700">
                  An onboarding fee is required to submit your seller registration.
                  You will be prompted to make a secure payment via Razorpay.
                </p>
              </div>
            )}

            <div className="mt-8 flex flex-row items-center gap-3 pt-4 border-t border-slate-100">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  disabled={isSubmitting || Boolean(uploadingImageKey)}
                  className="hidden w-1/3 shrink-0 lg:inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 px-4 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting || isAdvancing || Boolean(uploadingImageKey)}
                className="w-full flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#E21A22] px-4 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70 shadow-sm"
              >
                {isSubmitting || isAdvancing ? (currentStep === 4 ? "Submitting..." : "Saving...") : currentStep === 4 ? "Submit for approval" : "Next step"}
                {!isSubmitting && <ArrowRight className="h-4 w-4 ml-1" />}
              </button>
            </div>
          </motion.form>
          </div>
        </main>
      </div>

      {showQuitModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-md">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Exit registration?</h3>
                <p className="mt-1 text-sm font-medium leading-relaxed text-slate-500">
                  Do you want to exit registration? Filled details will be removed.
                </p>
              </div>
              <button
                type="button"
                onClick={stayOnRegistration}
                className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-2.5 p-5">
              <button
                type="button"
                onClick={stayOnRegistration}
                className="h-12 rounded-2xl bg-[#E21A22] text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-red-500/15 transition-all active:scale-[0.98]"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={quitRegistration}
                disabled={isQuitting}
                className="h-12 rounded-2xl bg-slate-50 text-sm font-bold text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-800 disabled:opacity-60"
              >
                {isQuitting ? "Exiting..." : "Exit registration"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}



