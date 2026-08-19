import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@core/context/AuthContext";
import { motion } from "framer-motion";
import {
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
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { sellerApi } from "../services/sellerApi";
import MapPicker from "@shared/components/MapPicker";

const businessTypes = [
  "Grocery",
  "Bakery",
  "Pharmacy",
  "Electronics",
  "Fashion",
  "General Store",
];

const initialState = {
  name: "",
  shopName: "",
  email: "",
  phone: "",
  zoneId: "",
  zoneSource: "",
  address: "",
  lat: "",
  lng: "",
  radius: 5,
  businessType: "",
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

const formatTimeAMPM = (timeStr) => {
  if (!timeStr) return "";
  const [hourStr, minuteStr] = timeStr.split(":");
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  hour = hour ? hour : 12;
  return `${String(hour).padStart(2, "0")}:${minuteStr} ${ampm}`;
};

const buildOpeningHoursLabel = (openingTime, closingTime) => {
  if (!openingTime || !closingTime) return "";
  return `${formatTimeAMPM(openingTime)} - ${formatTimeAMPM(closingTime)}`;
};
const timeOptions = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
});

const normalizeTimeValue = (value) => {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
};

const getSellerPhone = (seller = {}) => seller.phone || "";


export default function SellerOnboarding() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState(initialState);
  const [qrFile, setQrFile] = useState(null);
  const [licenseFile, setLicenseFile] = useState(null);
  const [panFile, setPanFile] = useState(null);
  const [gstFile, setGstFile] = useState(null);
  const [fssaiFile, setFssaiFile] = useState(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [zones, setZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [isSavingHours, setIsSavingHours] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hoursDraft, setHoursDraft] = useState({ openingTime: "", closingTime: "" });

  useEffect(() => {
    if (user) {
      setForm((prev) => ({ ...initialState, phone: getSellerPhone(user) || prev.phone }));
      setHoursDraft({ openingTime: "", closingTime: "" });
    }
  }, [user]);

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
        setForm((prev) => ({ ...initialState, phone: getSellerPhone(data) || prev.phone }));
        setHoursDraft(parseOpeningHours(data?.shopInfo?.openingHours || data?.openingHours || ""));
      } catch (error) {
        if (error?.response?.status !== 401) {
          toast.error("Failed to load seller onboarding data");
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
    setForm((prev) => ({ ...prev, [field]: value }));
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

    if (hoursDraft.closingTime <= hoursDraft.openingTime) {
      toast.error("Closing time must be after opening time");
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

  const handleLocationSelect = (location) => {
    setForm((prev) => ({
      ...prev,
      lat: Number.isFinite(location?.lat) ? Number(location.lat.toFixed(6)) : prev.lat,
      lng: Number.isFinite(location?.lng) ? Number(location.lng.toFixed(6)) : prev.lng,
      radius: location?.radius !== undefined ? location.radius : prev.radius,
      address: location?.address || prev.address,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name || !form.shopName || !form.email || !form.address) {
      toast.error("Fill seller name, shop name, email, and address first");
      return;
    }

    if (form.lat && form.lng && selectedZone?.coordinates?.length >= 3) {
      const isPointInPolygon = (point, vs) => {
        let x = point.lat, y = point.lng;
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
          let xi = Number(vs[i].lat ?? vs[i].latitude), yi = Number(vs[i].lng ?? vs[i].longitude);
          let xj = Number(vs[j].lat ?? vs[j].latitude), yj = Number(vs[j].lng ?? vs[j].longitude);
          let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
          if (intersect) inside = !inside;
        }
        return inside;
      };
      
      const pt = { lat: Number(form.lat), lng: Number(form.lng) };
      if (!isPointInPolygon(pt, selectedZone.coordinates)) {
        toast.error("Store location must be inside the selected service zone. Please update your map pin.");
        return;
      }
    }

    if (form.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.email)) {
      toast.error("Enter a valid email address (e.g. name@gmail.com)");
      return;
    }

    if (form.supportEmail && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.supportEmail)) {
      toast.error("Enter a valid support email address (e.g. support@example.com)");
      return;
    }

    if (form.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.panNumber)) {
      toast.error("Invalid PAN format. Must be 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)");
      return;
    }

    if (form.gstRegistered) {
      if (!form.gstNumber || !form.gstLegalName) {
        toast.error("GST number and GST legal name are required when GST is registered");
        return;
      }
      if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstNumber)) {
        toast.error("Invalid GST format. Must be 15 characters (e.g. 22ABCDE1234F1Z5)");
        return;
      }
    }

    if (form.fssaiExpiry && form.fssaiExpiry < new Date().toISOString().split("T")[0]) {
      toast.error("FSSAI expiry date cannot be a past date");
      return;
    }

    if (form.shopLicenseNumber && !/^[A-Za-z0-9\/\-]{5,20}$/.test(form.shopLicenseNumber)) {
      toast.error("Shop license number must be 5–20 characters (letters, numbers, / and - only)");
      return;
    }

    if (form.shopLicenseExpiry && form.shopLicenseExpiry < new Date().toISOString().split("T")[0]) {
      toast.error("Shop license expiry date cannot be a past date");
      return;
    }

    if (form.accountNumber && !/^\d{6,20}$/.test(form.accountNumber)) {
      toast.error("Account number must be 6–20 digits (numbers only)");
      return;
    }

    if (form.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode)) {
      toast.error("Invalid IFSC code. Format: 4 letters + 0 + 6 alphanumeric (e.g. ABCD0EF1234)");
      return;
    }

    if (form.upiId && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(form.upiId)) {
      toast.error("Invalid UPI ID. Format: username@bankhandle (e.g. name@okhdfcbank)");
      return;
    }

    if (form.alternatePhone && form.alternatePhone === form.phone) {
      toast.error("Alternate phone number cannot be the same as primary phone number");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = new FormData();
      const nextForm = {
        ...form,
        zoneName: selectedZone?.label || "",
        ...(form.gstRegistered === false && {
          gstNumber: "",
          gstLegalName: "",
        }),
      };
      Object.entries(nextForm).forEach(([key, value]) => {
        payload.append(
          key,
          typeof value === "boolean" ? String(value) : String(value ?? ""),
        );
      });
      payload.append("submitForApproval", "true");
      if (qrFile) payload.append("upiQrImage", qrFile);
      if (licenseFile) payload.append("shopLicenseImage", licenseFile);
      if (panFile) payload.append("panImage", panFile);
      if (gstFile) payload.append("gstImage", gstFile);
      if (fssaiFile) payload.append("fssaiImage", fssaiFile);

      await sellerApi.updateProfile(payload);
      await refreshUser();
      toast.success("Application submitted for admin approval");
      navigate("/seller/pending", { replace: true });
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_28%),linear-gradient(180deg,#f8fafc_0%,#fffaf2_100%)] px-4 py-8 font-['Outfit'] md:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex justify-center">
          <motion.form
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className="w-full space-y-6 rounded-[34px] border border-white/70 bg-white/90 p-6 shadow-[0_35px_90px_rgba(15,23,42,0.08)] backdrop-blur xl:p-8"
          >
            <section className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    Store identity
                  </h2>
                  <p className="text-sm font-medium text-slate-500">
                    How your seller account will appear to admin and customers.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500">Seller name <span className="text-red-500">*</span></label>
                  <input required className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-slate-900" placeholder="Seller name" value={form.name} onChange={(e) => updateField("name", e.target.value.replace(/[^a-zA-Z\s]/g, ""))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500">Shop name <span className="text-red-500">*</span></label>
                  <input required className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-slate-900" placeholder="Shop name" value={form.shopName} onChange={(e) => updateField("shopName", e.target.value.replace(/[^a-zA-Z\s]/g, ""))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500">User Id <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`rounded-2xl border px-4 py-3 font-semibold outline-none focus:border-slate-900 ${form.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.email) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                    placeholder="User Id (e.g. name@domain.com)"
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                  />
                  {form.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.email) && (
                    <p className="text-xs font-semibold text-red-500 px-1">Enter a valid email address (e.g. name@domain.com)</p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500">Primary phone <span className="text-red-500">*</span></label>
                  <input className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 font-semibold text-slate-500 outline-none" placeholder="Primary phone" value={form.phone} readOnly title="Linked from the seller OTP login" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500">Business type <span className="text-red-500">*</span></label>
                  <select required className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-slate-900" value={form.businessType} onChange={(e) => updateField("businessType", e.target.value)}>
                  <option value="">Select business type</option>
                  {businessTypes.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500">Alternate phone <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`rounded-2xl border px-4 py-3 font-semibold outline-none focus:border-slate-900 ${form.alternatePhone && form.alternatePhone === form.phone ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                    placeholder="Alternate phone"
                    value={form.alternatePhone}
                    onChange={(e) => updateField("alternatePhone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                  />
                  {form.alternatePhone && form.alternatePhone === form.phone && (
                    <p className="text-xs font-semibold text-red-500 px-1">Alternate number cannot be same as primary number</p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500">Service zone <span className="text-red-500">*</span></label>
                <select
                  required
                  className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-slate-900"
                  value={`${form.zoneSource}:${form.zoneId}`}
                  onChange={(e) => {
                    const [zoneSource, zoneId] = e.target.value.split(":");
                    setForm((prev) => ({
                      ...prev,
                      zoneSource: zoneSource || "",
                      zoneId: zoneId || "",
                    }));
                  }}
                  disabled={zonesLoading}
                >
                  <option value=":">
                    {zonesLoading ? "Loading zones..." : "Select a service zone"}
                  </option>
                  {zones.map((zone) => {
                    const zoneId = String(zone?._id || zone?.id || "");
                    const zoneSource = String(zone?.source || "");
                    return (
                      <option key={`${zoneSource}-${zoneId}`} value={`${zoneSource}:${zoneId}`}>
                        {zone.label}
                      </option>
                    );
                  })}
                </select>
                </div>
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500">Support email <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`rounded-2xl border px-4 py-3 font-semibold outline-none focus:border-slate-900 ${form.supportEmail && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.supportEmail) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                    placeholder="Support email (e.g. support@example.com)"
                    type="email"
                    value={form.supportEmail}
                    onChange={(e) => updateField("supportEmail", e.target.value)}
                  />
                  {form.supportEmail && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.supportEmail) && (
                    <p className="text-xs font-semibold text-red-500 px-1">Enter a valid email address (e.g. support@example.com)</p>
                  )}
                </div>
                {selectedZone ? (
                  <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 md:col-span-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary-orange">Selected zone</p>
                    <p className="mt-1 text-sm font-semibold text-orange-950">
                      {selectedZone.label}
                    </p>
                  </div>
                ) : null}
                <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 md:col-span-2">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-900">Opening hours</p>
                      <p className="text-xs font-medium text-slate-500">Select your daily opening and closing time.</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      {openingHoursPreview}
                    </span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Opens at</span>
                      <select
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:border-slate-900"
                        value={hoursDraft.openingTime}
                        onChange={(e) => handleOpeningHoursChange("openingTime", e.target.value)}
                      >
                        <option value="">Select opening time</option>
                        {timeOptions.map((time) => (
                          <option key={time} value={time}>
                            {formatTimeAMPM(time)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Closes at</span>
                      <select
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:border-slate-900"
                        value={hoursDraft.closingTime}
                        onChange={(e) => handleOpeningHoursChange("closingTime", e.target.value)}
                      >
                        <option value="">Select closing time</option>
                        {timeOptions.map((time) => (
                          <option key={time} value={time}>
                            {formatTimeAMPM(time)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveOpeningHours}
                      disabled={isSavingHours}
                      className="inline-flex items-center gap-2 rounded-2xl bg-primary-orange hover:bg-primary-hover active:bg-primary-dark px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white transition disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSavingHours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      {isSavingHours ? "Saving..." : "Save Hours"}
                    </button>
                  </div>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 md:col-span-2">
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-black text-slate-900">Store location</p>
                      <p className="text-xs font-medium text-slate-500">Pin your storefront on the map so deliveries route correctly.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMapOpen(true)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-orange hover:bg-primary-hover active:bg-primary-dark px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white transition-colors"
                    >
                      <MapPin className="h-4 w-4" />
                      {form.lat && form.lng ? "Change Pin" : "Pick On Map"}
                    </button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-1">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Selected address</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
                        {form.address || "Choose your store location on the map to auto-fill the address."}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Latitude</p>
                      <p className="mt-1 font-semibold text-slate-700">{(form.lat !== null && form.lat !== "") ? form.lat : "Not selected"}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Longitude</p>
                      <p className="mt-1 font-semibold text-slate-700">{(form.lng !== null && form.lng !== "") ? form.lng : "Not selected"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-5 rounded-[28px] bg-slate-50/80 p-5">
              <h2 className="text-lg font-black text-slate-900">
                Banking and UPI
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500">Bank name <span className="text-red-500">*</span></label>
                  <input required className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-slate-900" placeholder="Bank name" value={form.bankName} onChange={(e) => updateField("bankName", e.target.value.replace(/[^a-zA-Z\s]/g, ""))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500">Account holder name <span className="text-red-500">*</span></label>
                  <input required className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-slate-900" placeholder="Account holder name" value={form.accountHolderName} onChange={(e) => updateField("accountHolderName", e.target.value.replace(/[^a-zA-Z\s]/g, ""))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500">Account number <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`rounded-2xl border px-4 py-3 font-semibold outline-none focus:border-slate-900 ${form.accountNumber && !/^\d{6,20}$/.test(form.accountNumber) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                    placeholder="Account number (6–20 digits)"
                    value={form.accountNumber}
                    maxLength={20}
                    onChange={(e) => updateField("accountNumber", e.target.value.replace(/\D/g, "").slice(0, 20))}
                  />
                  {form.accountNumber && !/^\d{6,20}$/.test(form.accountNumber) && (
                    <p className="text-xs font-semibold text-red-500 px-1">Account number must be 6–20 digits (numbers only)</p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500">IFSC code <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`rounded-2xl border px-4 py-3 font-semibold uppercase outline-none focus:border-slate-900 ${form.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                    placeholder="IFSC code (e.g. ABCD0EF1234)"
                    value={form.ifscCode}
                    maxLength={11}
                    onChange={(e) => updateField("ifscCode", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11))}
                  />
                  {form.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode) && (
                    <p className="text-xs font-semibold text-red-500 px-1">Invalid IFSC: 4 letters + 0 + 6 alphanumeric (e.g. ABCD0EF1234)</p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500">Account type <span className="text-red-500">*</span></label>
                <select
                  required
                  className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-slate-900"
                  value={form.accountType}
                  onChange={(e) => updateField("accountType", e.target.value)}
                >
                  <option value="">Select account type</option>
                  <option value="Savings">Savings Account</option>
                  <option value="Current">Current Account</option>
                  <option value="Salary">Salary Account</option>
                  <option value="Fixed Deposit">Fixed Deposit Account</option>
                  <option value="Recurring Deposit">Recurring Deposit Account</option>
                  <option value="NRI">NRI Account (NRE/NRO)</option>
                  <option value="Jan Dhan">Jan Dhan Account</option>
                  <option value="BSBDA">Basic Savings Bank Deposit (BSBDA)</option>
                </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500">UPI ID <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`rounded-2xl border px-4 py-3 font-semibold outline-none focus:border-slate-900 ${form.upiId && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(form.upiId) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                    placeholder="UPI ID (e.g. name@okhdfcbank)"
                    value={form.upiId}
                    onChange={(e) => updateField("upiId", e.target.value)}
                  />
                  {form.upiId && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(form.upiId) && (
                    <p className="text-xs font-semibold text-red-500 px-1">Invalid UPI ID. Format: username@bankhandle (e.g. name@okhdfcbank)</p>
                  )}
                </div>
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500">UPI QR image <span className="text-red-500">*</span></label>
                  <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700">
                    <span className="truncate min-w-0 flex-1 mr-2">{qrFile?.name || "Upload UPI QR image"}</span>
                    <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white">
                      <Upload className="h-3.5 w-3.5" />
                      Choose
                    </span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => setQrFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              </div>
            </section>

            <section className="space-y-5">
              <h2 className="text-lg font-black text-slate-900">
                Compliance and license
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500">PAN number <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`rounded-2xl border px-4 py-3 font-semibold uppercase outline-none focus:border-slate-900 ${form.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.panNumber) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                    placeholder="PAN number (e.g. ABCDE1234F)"
                    value={form.panNumber}
                    maxLength={10}
                    onChange={(e) => updateField("panNumber", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))}
                  />
                  {form.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.panNumber) && (
                    <p className="text-xs font-semibold text-red-500 px-1">Invalid PAN format. Must be 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)</p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500">PAN image <span className="text-red-500">*</span></label>
                  <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700">
                    <span className="truncate min-w-0 flex-1 mr-2">{panFile?.name || "Upload PAN image"}</span>
                    <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-amber-500 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white">
                      <UploadCloud className="h-3.5 w-3.5" />
                      Choose
                    </span>
                    <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setPanFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 font-semibold text-slate-700">
                  <input type="checkbox" checked={form.gstRegistered} onChange={(e) => updateField("gstRegistered", e.target.checked)} />
                  GST registered
                </label>
                {form.gstRegistered && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-500">GST number <span className="text-red-500">*</span></label>
                      <input
                        required
                        className={`rounded-2xl border px-4 py-3 font-semibold uppercase outline-none focus:border-slate-900 ${form.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstNumber) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                        placeholder="GST number (e.g. 22ABCDE1234F1Z5)"
                        value={form.gstNumber}
                        maxLength={15}
                        onChange={(e) => updateField("gstNumber", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15))}
                      />
                      {form.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstNumber) && (
                        <p className="text-xs font-semibold text-red-500 px-1">Invalid GST format. Must be 15 chars: 2 digits + PAN (10) + entity + Z + check (e.g. 22ABCDE1234F1Z5)</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 md:col-span-2">
                      <label className="text-xs font-bold text-slate-500">GST legal name <span className="text-red-500">*</span></label>
                      <input required className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-slate-900" placeholder="GST legal name" value={form.gstLegalName} onChange={(e) => updateField("gstLegalName", e.target.value.replace(/[^a-zA-Z\s]/g, ""))} />
                    </div>
                    <div className="flex flex-col gap-1 md:col-span-2">
                      <label className="text-xs font-bold text-slate-500">GST certificate image <span className="text-red-500">*</span></label>
                      <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700">
                        <span className="truncate min-w-0 flex-1 mr-2">{gstFile?.name || "Upload GST image"}</span>
                        <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-amber-500 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white">
                          <UploadCloud className="h-3.5 w-3.5" />
                          Choose
                        </span>
                        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setGstFile(e.target.files?.[0] || null)} />
                      </label>
                    </div>
                  </>
                )}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500">FSSAI number <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`rounded-2xl border px-4 py-3 font-semibold outline-none focus:border-slate-900 ${form.fssaiNumber && !/^\d{14}$/.test(form.fssaiNumber) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                    placeholder="FSSAI number (14 digits)"
                    value={form.fssaiNumber}
                    maxLength={14}
                    onChange={(e) => updateField("fssaiNumber", e.target.value.replace(/\D/g, "").slice(0, 14))}
                  />
                  {form.fssaiNumber && !/^\d{14}$/.test(form.fssaiNumber) && (
                    <p className="text-xs font-semibold text-red-500 px-1">FSSAI number must be exactly 14 digits (numbers only)</p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500">FSSAI license image <span className="text-red-500">*</span></label>
                  <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700">
                    <span className="truncate min-w-0 flex-1 mr-2">{fssaiFile?.name || "Upload FSSAI image"}</span>
                    <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-amber-500 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white">
                      <UploadCloud className="h-3.5 w-3.5" />
                      Choose
                    </span>
                    <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFssaiFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500">FSSAI expiry date <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`rounded-2xl border px-4 py-3 font-semibold outline-none focus:border-slate-900 ${form.fssaiExpiry && form.fssaiExpiry < new Date().toISOString().split("T")[0] ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                    type="date"
                    value={form.fssaiExpiry}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => updateField("fssaiExpiry", e.target.value)}
                  />
                  {form.fssaiExpiry && form.fssaiExpiry < new Date().toISOString().split("T")[0] && (
                    <p className="text-xs font-semibold text-red-500 px-1">FSSAI expiry date cannot be a past date</p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500">Shop license number <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`rounded-2xl border px-4 py-3 font-semibold outline-none focus:border-slate-900 ${form.shopLicenseNumber && !/^[A-Za-z0-9\/\-]{5,20}$/.test(form.shopLicenseNumber) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                    placeholder="Shop license number (e.g. MH/2023/12345)"
                    value={form.shopLicenseNumber}
                    maxLength={20}
                    onChange={(e) => updateField("shopLicenseNumber", e.target.value.replace(/[^A-Za-z0-9\/\-]/g, "").slice(0, 20))}
                  />
                  {form.shopLicenseNumber && !/^[A-Za-z0-9\/\-]{5,20}$/.test(form.shopLicenseNumber) && (
                    <p className="text-xs font-semibold text-red-500 px-1">License number must be 5–20 characters (letters, numbers, / and - only)</p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500">Shop license expiry date <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={`rounded-2xl border px-4 py-3 font-semibold outline-none focus:border-slate-900 ${form.shopLicenseExpiry && form.shopLicenseExpiry < new Date().toISOString().split("T")[0] ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                    type="date"
                    value={form.shopLicenseExpiry}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => updateField("shopLicenseExpiry", e.target.value)}
                  />
                  {form.shopLicenseExpiry && form.shopLicenseExpiry < new Date().toISOString().split("T")[0] && (
                    <p className="text-xs font-semibold text-red-500 px-1">Shop license expiry date cannot be a past date</p>
                  )}
                </div>
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500">Shop license image <span className="text-red-500">*</span></label>
                  <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700">
                    <span className="truncate min-w-0 flex-1 mr-2">{licenseFile?.name || "Upload shop license image"}</span>
                    <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-amber-500 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white">
                      <Upload className="h-3.5 w-3.5" />
                      Choose
                    </span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => setLicenseFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              </div>
            </section>

            <div className="flex flex-col gap-3 border-t border-slate-100 pt-6 md:flex-row md:items-center md:justify-between">
              <p className="max-w-xl text-sm font-medium leading-6 text-slate-500">
                When you submit, the seller request will move into admin review
                under quick-commerce. Approval unlocks the seller dashboard.
              </p>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-orange hover:bg-primary-hover active:bg-primary-dark px-6 py-4 text-sm font-black uppercase tracking-[0.22em] text-white transition-colors disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Submitting..." : "Submit for approval"}
                {!isSubmitting && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </motion.form>
        </div>
      </div>

      {isMapOpen && (
        <MapPicker
          isOpen={isMapOpen}
          onClose={() => setIsMapOpen(false)}
          onConfirm={handleLocationSelect}
          initialLocation={initialLocation}
          initialRadius={Number(form.radius) || 5}
          maxRadius={100}
          zoneCoordinates={selectedZone?.coordinates || []}
          zoneLabel={selectedZone?.label || ""}
        />
      )}
    </div>
  );
}



