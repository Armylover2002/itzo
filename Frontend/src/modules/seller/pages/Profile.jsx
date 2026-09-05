import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Badge from "@shared/components/ui/Badge";
import {
  Shield,
  Edit2,
  Save,
  MapPin,
  Clock3,
  Upload,
  Loader2,
  LogOut,
  Trash2,
  AlertTriangle,
  Check,
} from "lucide-react";
import { sellerApi } from "../services/sellerApi";
import { toast } from "sonner";
import MapPicker from "@shared/components/MapPicker";
import { clearModuleAuth } from "@food/utils/auth";
import { useAuth } from "@core/context/AuthContext";
import { formatOpeningHoursAMPM } from "@shared/utils/timeFormat";
import { isPointInZone } from "@shared/utils/pointInZone";
import {
  parseOpeningHours,
  buildOpeningHoursLabel,
  normalizeTimeValue,
  timeOptions,
} from "../utils/openingHours";
import { SELLER_LIVE_UPDATE_EVENT } from "../components/SellerLiveUpdates";

const toDateInputValue = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? String(value).slice(0, 10)
    : parsed.toLocaleDateString("en-CA");
};

const profileToForm = (data = {}) => ({
  name: data.name || "",
  shopName: data.shopName || "",
  phone: data.phone || "",
  email: data.email || "",
  alternatePhone: data.shopInfo?.alternatePhone || "",
  supportEmail: data.shopInfo?.supportEmail || "",
  openingHours: data.shopInfo?.openingHours || "",
  zoneId: data.shopInfo?.zoneId ? String(data.shopInfo.zoneId) : "",
  zoneSource: data.shopInfo?.zoneSource || "",
  zoneName: data.shopInfo?.zoneName || "",
  shopImage: data.shopInfo?.shopImage || "",
  businessType: data.shopInfo?.businessType || "",
  lat: data.location?.latitude ?? data.location?.coordinates?.[1] ?? "",
  lng: data.location?.longitude ?? data.location?.coordinates?.[0] ?? "",
  address: data.address || data.location?.formattedAddress || "",
  bankName: data.bankInfo?.bankName || "",
  accountHolderName: data.bankInfo?.accountHolderName || "",
  accountNumber: data.bankInfo?.accountNumber || "",
  ifscCode: data.bankInfo?.ifscCode || "",
  accountType: data.bankInfo?.accountType || "",
  upiId: data.bankInfo?.upiId || "",
  upiQrImage: data.bankInfo?.upiQrImage || "",
  panNumber: data.documents?.panNumber || "",
  gstRegistered: data.documents?.gstRegistered === true,
  gstNumber: data.documents?.gstNumber || "",
  gstLegalName: data.documents?.gstLegalName || "",
  fssaiNumber: data.documents?.fssaiNumber || "",
  fssaiExpiry: toDateInputValue(data.documents?.fssaiExpiry),
  fssaiImage: data.documents?.fssaiImage || "",
  shopLicenseNumber: data.documents?.shopLicenseNumber || "",
  shopLicenseExpiry: toDateInputValue(data.documents?.shopLicenseExpiry),
  shopLicenseImage: data.documents?.shopLicenseImage || "",
});

const inputClass =
  "w-full px-3 py-1.5 bg-slate-50/70 border border-slate-200 rounded-lg text-xs font-normal text-slate-900 outline-none focus:bg-white focus:border-[#e71d28] focus:ring-1 focus:ring-[#e71d28]/20 transition-all disabled:opacity-70";

const PAN_NUMBER_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GST_NUMBER_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GST_LEGAL_NAME_REGEX = /^[A-Za-z][A-Za-z\s]{1,}$/;

const Field = ({ label, value, pending, proposedValue, children, editing }) => (
  <div className="space-y-1">
    <label className="text-xs font-medium text-slate-700 block">
      {label}
      {pending ? (
        <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600">
          Pending
        </span>
      ) : null}
    </label>
    {editing ? (
      children
    ) : (
      <div className="space-y-1">
        <p className="w-full px-3 py-1.5 bg-slate-50/70 border border-slate-200 rounded-lg text-xs font-normal text-slate-900 break-words min-h-[34px] flex items-center">
          {value || "—"}
        </p>
        {pending && proposedValue ? (
          <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-800 border border-amber-100">
            Requested: {proposedValue}
          </p>
        ) : null}
      </div>
    )}
  </div>
);

const ImageField = ({ label, url, pending, proposedUrl, editing, uploading, onSelect }) => (
  <div className="space-y-1.5">
    <p className="text-xs font-medium text-slate-700">
      {label}
      {pending ? <span className="ml-1.5 text-[10px] font-semibold text-amber-600">Pending</span> : null}
    </p>
    {url ? (
      <img src={url} alt={label} className="h-24 w-full max-w-[180px] rounded-lg border border-slate-200 object-cover" />
    ) : (
      <div className="flex h-24 w-full max-w-[180px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-400">
        No image
      </div>
    )}
    {pending && proposedUrl && proposedUrl !== url ? (
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">Requested image</p>
        <img src={proposedUrl} alt={`${label} pending`} className="h-20 w-full max-w-[140px] rounded-lg border border-amber-200 object-cover" />
      </div>
    ) : null}
    {editing ? (
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-red-700 transition-colors">
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {uploading ? "Uploading…" : "Replace"}
        <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={onSelect} />
      </label>
    ) : null}
  </div>
);

const SellerProfile = () => {
  const { logout, refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const pendingUpdateRef = useRef(false);
  const isEditingRef = useRef(false);
  const [formData, setFormData] = useState(profileToForm());
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadingImageKey, setUploadingImageKey] = useState(null);
  const [zones, setZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [hoursDraft, setHoursDraft] = useState({ openingTime: "", closingTime: "" });
  const [isSavingHours, setIsSavingHours] = useState(false);
  const [justApprovedUpdate, setJustApprovedUpdate] = useState(false);

  isEditingRef.current = isEditing;
  const hasPendingUpdate = profile?.hasPendingProfileUpdate === true;
  const proposed = profile?.pendingProfileChanges?.proposed || {};

  const pendingField = (path, liveValue) => {
    const parts = String(path).split(".");
    let node = proposed;
    for (const part of parts) {
      if (!node || typeof node !== "object") {
        return { liveValue, pending: false, proposedValue: null };
      }
      node = node[part];
    }
    if (node === undefined || node === null || node === "") {
      return { liveValue, pending: false, proposedValue: null };
    }
    if (path === "location" && typeof node === "object") {
      return {
        liveValue,
        pending: true,
        proposedValue: node.formattedAddress || node.address || "",
      };
    }
    return { liveValue, pending: true, proposedValue: node };
  };

  const fetchProfile = useCallback(async ({ silent = false } = {}) => {
    const sellerToken = localStorage.getItem("auth_seller");
    if (!sellerToken) {
      setIsLoading(false);
      return;
    }
    try {
      const response = await sellerApi.getProfile({ forceRefresh: true });
      const data = response.data.result;
      const wasPending = pendingUpdateRef.current;
      const isPending = data?.hasPendingProfileUpdate === true;
      pendingUpdateRef.current = isPending;
      setProfile(data);
      window.dispatchEvent(new CustomEvent('sellerProfileUpdated', { detail: data }));
      if (!isEditingRef.current) {
        setFormData(profileToForm(data));
        setHoursDraft(parseOpeningHours(data?.shopInfo?.openingHours || ""));
      }
      if (wasPending && !isPending) {
        setJustApprovedUpdate(true);
        toast.success("Your profile update was approved. Details are now live.");
        refreshUser({ forceRefresh: true }).catch(() => {});
      }
    } catch (error) {
      if (!silent && error?.response?.status !== 401) toast.error("Failed to fetch profile");
    } finally {
      setIsLoading(false);
    }
  }, [refreshUser]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    const onLive = () => {
      fetchProfile({ silent: true });
    };
    window.addEventListener(SELLER_LIVE_UPDATE_EVENT, onLive);
    return () => window.removeEventListener(SELLER_LIVE_UPDATE_EVENT, onLive);
  }, [fetchProfile]);

  useEffect(() => {
    if (!hasPendingUpdate) return undefined;
    const timer = setInterval(() => {
      fetchProfile({ silent: true });
    }, 12000);
    return () => clearInterval(timer);
  }, [hasPendingUpdate, fetchProfile]);

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
      } catch {
        setZones([]);
      } finally {
        setZonesLoading(false);
      }
    };
    loadZones();
  }, []);

  const selectedZone = useMemo(
    () =>
      zones.find(
        (zone) =>
          String(zone?._id || zone?.id || "") === String(formData.zoneId || "") &&
          String(zone?.source || "") === String(formData.zoneSource || ""),
      ) || null,
    [formData.zoneId, formData.zoneSource, zones],
  );

  const updateField = (field, value) => {
    setFormData((prev) => {
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
    const [zoneSource, zoneId] = value.split(":");
    const nextZone =
      zones.find(
        (zone) =>
          String(zone?._id || zone?.id || "") === String(zoneId || "") &&
          String(zone?.source || "") === String(zoneSource || ""),
      ) || null;
    setFormData((prev) => ({
      ...prev,
      zoneSource: zoneSource || "",
      zoneId: zoneId || "",
      zoneName: nextZone?.label || "",
      lat: "",
      lng: "",
      address: "",
    }));
  };

  const handleImageSelect = async (fieldKey, file) => {
    if (!file) return;
    setUploadingImageKey(fieldKey);
    try {
      const payload = new FormData();
      payload.append(fieldKey, file);
      const response = await sellerApi.updateProfile(payload);
      const result = response?.data?.result || {};
      await fetchProfile();
      toast.success(
        result?.hasPendingProfileUpdate
          ? "Image submitted for admin review"
          : "Image saved",
      );
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to upload image");
    } finally {
      setUploadingImageKey(null);
    }
  };

  const handleOpeningHoursChange = (key, value) => {
    setHoursDraft((prev) => ({ ...prev, [key]: normalizeTimeValue(value) }));
  };

  const handleSaveOpeningHours = async () => {
    if (!hoursDraft.openingTime || !hoursDraft.closingTime) {
      toast.error("Select both opening and closing time");
      return;
    }
    const openingHoursLabel = buildOpeningHoursLabel(
      hoursDraft.openingTime,
      hoursDraft.closingTime,
    );
    setIsSavingHours(true);
    try {
      updateField("openingHours", openingHoursLabel);
      const response = await sellerApi.updateProfile({ openingHours: openingHoursLabel });
      const result = response?.data?.result || {};
      setProfile(result);
      setFormData(profileToForm(result));
      setHoursDraft(parseOpeningHours(result?.shopInfo?.openingHours || openingHoursLabel));
      toast.success(
        result?.hasPendingProfileUpdate
          ? "Opening hours submitted for admin review"
          : "Opening hours saved",
      );
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save opening hours");
    } finally {
      setIsSavingHours(false);
    }
  };

  const handleLocationSelect = async (location) => {
    if (
      selectedZone?.coordinates?.length >= 3 &&
      !isPointInZone(location.lat, location.lng, selectedZone.coordinates)
    ) {
      toast.error(
        `Store location must be inside ${selectedZone.label}. Pin your shop within the selected zone.`,
      );
      return;
    }
    const next = {
      lat: location.lat,
      lng: location.lng,
      address: location.address || location.formattedAddress || "",
    };
    setFormData((prev) => ({ ...prev, ...next }));
    try {
      await sellerApi.updateProfile(next);
      toast.success("Location change submitted for admin review");
      await fetchProfile();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update location");
      await fetchProfile();
    }
  };

  const handleSubmit = async () => {
    if (!formData.zoneId) {
      toast.error("Please select a service zone");
      return;
    }
    if (formData.panNumber && !PAN_NUMBER_REGEX.test(String(formData.panNumber).toUpperCase())) {
      toast.error("Invalid PAN format");
      return;
    }
    if (formData.gstRegistered) {
      if (!String(formData.gstNumber || "").trim()) {
        toast.error("GST number is required");
        return;
      }
      if (!GST_NUMBER_REGEX.test(String(formData.gstNumber).toUpperCase())) {
        toast.error("Invalid GST format");
        return;
      }
      if (!String(formData.gstLegalName || "").trim()) {
        toast.error("GST legal name is required");
        return;
      }
      if (!GST_LEGAL_NAME_REGEX.test(String(formData.gstLegalName).trim())) {
        toast.error("GST legal name must contain only letters");
        return;
      }
    }
    if (formData.lat && formData.lng && selectedZone?.coordinates?.length >= 3) {
      if (!isPointInZone(formData.lat, formData.lng, selectedZone.coordinates)) {
        toast.error(
          `Store location must be inside ${selectedZone.label}. Update your map pin.`,
        );
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload = new FormData();
      const nextForm = {
        ...formData,
        gstRegistered: Boolean(formData.gstRegistered),
        gstNumber: formData.gstRegistered ? formData.gstNumber : "",
        gstLegalName: formData.gstRegistered ? formData.gstLegalName : "",
      };
      Object.entries(nextForm).forEach(([key, value]) => {
        if (["lat", "lng", "address", "businessType"].includes(key)) return;
        payload.append(key, typeof value === "boolean" ? String(value) : String(value ?? ""));
      });
      if (formData.lat !== "" && formData.lng !== "") {
        payload.append("lat", String(formData.lat));
        payload.append("lng", String(formData.lng));
        payload.append("address", formData.address || "");
      }

      const response = await sellerApi.updateProfile(payload);
      const result = response?.data?.result || {};
      setProfile(result);
      setFormData(profileToForm(result));
      setHoursDraft(parseOpeningHours(result?.shopInfo?.openingHours || ""));
      setIsEditing(false);
      toast.success(
        result?.hasPendingProfileUpdate
          ? "Changes submitted for admin approval"
          : "Profile updated successfully",
      );
      await fetchProfile();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await sellerApi.deleteAccount();
      clearModuleAuth("seller");
      toast.success("Account deleted successfully");
      window.location.href = "/seller/auth";
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete account");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const initialLocation = useMemo(
    () =>
      formData.lat !== "" && formData.lng !== ""
        ? { lat: Number(formData.lat), lng: Number(formData.lng) }
        : null,
    [formData.lat, formData.lng],
  );

  const openingHoursPreview =
    buildOpeningHoursLabel(hoursDraft.openingTime, hoursDraft.closingTime) ||
    formData.openingHours ||
    "Not set";

  const displayShopImage = formData.shopImage || profile?.shopInfo?.shopImage || "";
  const pendingShopImage = pendingField("shopInfo.shopImage", displayShopImage);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  return (
    <div className="space-y-4 px-3.5 md:px-4 max-w-5xl md:max-w-none mx-auto w-full pb-20">
      <div className="bg-white rounded-2xl md:rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Seller Profile
            <Badge
              variant="secondary"
              className="text-[9px] px-1.5 py-0 font-bold tracking-wider uppercase">
              Store Account
            </Badge>
          </h1>
          <p className="text-slate-600 text-xs sm:text-sm mt-1 font-medium">
            Manage your store details, documents, banking, and location.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-gradient-to-r from-rose-50/70 via-white to-amber-50/60 p-3 sm:p-4 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full overflow-hidden bg-rose-500 text-white font-semibold text-base sm:text-lg flex items-center justify-center shadow-xs border-2 border-white shrink-0">
            {displayShopImage ? (
              <img src={displayShopImage} alt="Shop" className="h-full w-full object-cover" />
            ) : (
              <span>{profile?.name?.charAt(0)?.toUpperCase() || "S"}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-sm sm:text-base font-semibold text-[#1c1c1e] tracking-tight truncate">
                {profile?.shopName || profile?.name || "Merchant Store"}
              </h2>
              <span className="px-1.5 py-0.5 bg-rose-100/80 text-rose-700 text-[10px] font-medium uppercase rounded border border-rose-200/60">
                {formData.businessType || "Seller"}
              </span>
              {formData.zoneName ? (
                <span className="px-1.5 py-0.5 bg-red-50 text-red-700 text-[10px] font-medium rounded border border-red-200/60 truncate max-w-[140px]">
                  {formData.zoneName}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-slate-500 font-normal truncate mt-0.5">
              {profile?.name || "Seller"}
            </p>
            {profile?.sellerCode ? (
              <p className="text-[11px] text-slate-400 font-semibold truncate mt-0.5">
                ID #{profile.sellerCode}
              </p>
            ) : null}
          </div>
        </div>
        <div className="shrink-0">
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-xs transition-all"
            >
              <Edit2 className="h-3.5 w-3.5 text-slate-500" />
              <span>Edit</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setFormData(profileToForm(profile));
                  setHoursDraft(parseOpeningHours(profile?.shopInfo?.openingHours || ""));
                }}
                className="px-2.5 py-1.5 bg-white text-slate-600 border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving || Boolean(uploadingImageKey)}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs disabled:opacity-70"
              >
                <Save className="h-3.5 w-3.5" />
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          )}
        </div>
      </div>

      {hasPendingUpdate ? (
        <div className="rounded-xl border border-amber-200/70 bg-amber-50/80 p-3 flex items-start gap-2.5">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-xs font-semibold text-amber-900">Changes pending admin approval</p>
            <p className="mt-0.5 text-[11px] font-normal text-amber-800 leading-normal">
              Customers still see your approved details until admin reviews the updates.
            </p>
          </div>
        </div>
      ) : justApprovedUpdate ? (
        <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/80 p-3 flex items-start gap-2.5">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div>
            <p className="text-xs font-semibold text-emerald-900">Profile update approved</p>
            <p className="mt-0.5 text-[11px] font-normal text-emerald-800 leading-normal">
              Your latest details are now live. Check the notification bell for the confirmation.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
        <div className="md:col-span-2 space-y-3.5 sm:space-y-4">
          <div className="p-3.5 sm:p-5 rounded-xl border border-slate-200/80 bg-white shadow-xs">
            <h3 className="text-xs sm:text-sm font-semibold text-[#1c1c1e] tracking-tight mb-3 pb-2 border-b border-slate-100">
              Store details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ["name", "Owner name"],
                ["shopName", "Shop name"],
                ["phone", "Primary phone"],
                ["email", "Email"],
                ["alternatePhone", "Alternate phone"],
                ["supportEmail", "Support email"],
              ].map(([key, label]) => {
                const pathName = key === "alternatePhone" || key === "supportEmail" ? `shopInfo.${key}` : key;
                const display = pendingField(pathName, formData[key]);
                return (
                  <Field
                    key={key}
                    label={label}
                    value={display.liveValue}
                    proposedValue={display.proposedValue}
                    pending={display.pending}
                    editing={isEditing}
                  >
                    <input
                      value={formData[key] || ""}
                      onChange={(e) => updateField(key, e.target.value)}
                      disabled={key === "phone"}
                      className={inputClass}
                    />
                  </Field>
                );
              })}

              <Field
                label="Service zone"
                value={formData.zoneName || "—"}
                proposedValue={pendingField("shopInfo.zoneName", formData.zoneName).proposedValue}
                pending={pendingField("shopInfo.zoneName", formData.zoneName).pending}
                editing={isEditing}
              >
                <select
                  value={`${formData.zoneSource}:${formData.zoneId}`}
                  onChange={(e) => handleZoneChange(e.target.value)}
                  disabled={zonesLoading}
                  className={inputClass}
                >
                  <option value=":">{zonesLoading ? "Loading zones…" : "Select a service zone"}</option>
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
              </Field>

              <Field label="Business type" value={formData.businessType} editing={false} />
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100">
              <ImageField
                label="Shop photo"
                url={displayShopImage}
                proposedUrl={pendingShopImage.proposedValue}
                pending={pendingShopImage.pending}
                editing={isEditing}
                uploading={uploadingImageKey === "shopImage"}
                onSelect={(e) => handleImageSelect("shopImage", e.target.files?.[0])}
              />
            </div>
          </div>

          <div className="p-3.5 sm:p-5 rounded-xl border border-slate-200/80 bg-white shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <h3 className="text-xs sm:text-sm font-semibold text-[#1c1c1e] tracking-tight">Opening hours</h3>
              <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 border border-slate-100">
                {isEditing
                  ? openingHoursPreview
                  : formatOpeningHoursAMPM(formData.openingHours) || formData.openingHours || "Not set"}
              </span>
            </div>
            {!isEditing && pendingField("shopInfo.openingHours", formData.openingHours).pending ? (
              <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-800 border border-amber-100">
                Requested:{" "}
                {formatOpeningHoursAMPM(pendingField("shopInfo.openingHours", formData.openingHours).proposedValue) ||
                  pendingField("shopInfo.openingHours", formData.openingHours).proposedValue}
              </p>
            ) : null}
            {isEditing ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-slate-700">Opens at</span>
                    <select
                      className={inputClass}
                      value={hoursDraft.openingTime}
                      onChange={(e) => handleOpeningHoursChange("openingTime", e.target.value)}
                    >
                      <option value="">Select opening time</option>
                      {timeOptions.map((time) => (
                        <option key={time.value} value={time.value}>{time.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-slate-700">Closes at</span>
                    <select
                      className={inputClass}
                      value={hoursDraft.closingTime}
                      onChange={(e) => handleOpeningHoursChange("closingTime", e.target.value)}
                    >
                      <option value="">Select closing time</option>
                      {timeOptions.map((time) => (
                        <option key={time.value} value={time.value}>{time.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveOpeningHours}
                    disabled={isSavingHours}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-70"
                  >
                    {isSavingHours ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    {isSavingHours ? "Saving…" : "Save hours"}
                  </button>
                </div>
              </>
            ) : null}
          </div>

          <div className="p-3.5 sm:p-5 rounded-xl border border-slate-200/80 bg-white shadow-xs space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-xs sm:text-sm font-semibold text-[#1c1c1e] tracking-tight">Store location</h3>
              {isEditing ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedZone) {
                      toast.error("Select a service zone before pinning your store");
                      return;
                    }
                    setIsMapOpen(true);
                  }}
                  disabled={!selectedZone}
                  className="bg-white text-slate-700 border border-slate-200 hover:border-slate-800 rounded-md px-3 py-1.5 text-xs font-medium shadow-xs disabled:opacity-60"
                >
                  {formData.lat !== "" && formData.lng !== "" ? "Change pin" : "Pick on map"}
                </button>
              ) : null}
            </div>

            {selectedZone ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-red-600">Selected zone</p>
                <p className="mt-0.5 text-xs font-semibold text-red-900">{selectedZone.label}</p>
              </div>
            ) : null}

            <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200/60 space-y-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                    formData.lat !== "" && formData.lng !== ""
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-white text-slate-400 border border-slate-200"
                  }`}
                >
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#1c1c1e] truncate">
                    {formData.lat !== "" && formData.lng !== "" ? "Store location pin set" : "Location not defined"}
                  </p>
                  <p className="text-[11px] text-slate-500 font-normal truncate mt-0.5">
                    {formData.address || "Mark your shop on the map for delivery accuracy."}
                  </p>
                </div>
              </div>
              {pendingField("location", formData.address).pending ? (
                <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-800 border border-amber-100">
                  Requested: {pendingField("location", formData.address).proposedValue}
                </p>
              ) : null}
              {formData.lat !== "" && formData.lng !== "" ? (
                <div className="pt-2.5 border-t border-slate-200/60 flex flex-wrap gap-4 text-xs">
                  <div>
                    <span className="text-[10px] font-medium text-slate-500 uppercase block">Latitude</span>
                    <span className="font-semibold text-slate-800 tabular-nums">{Number(formData.lat).toFixed(6)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-medium text-slate-500 uppercase block">Longitude</span>
                    <span className="font-semibold text-slate-800 tabular-nums">{Number(formData.lng).toFixed(6)}</span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-start gap-2 p-2.5 bg-amber-50/80 rounded-lg border border-amber-200/60">
              <Shield className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800 font-normal leading-normal">
                Pin must stay inside your selected service zone. Place the marker at your physical storefront.
              </p>
            </div>
          </div>

          <div className="p-3.5 sm:p-5 rounded-xl border border-slate-200/80 bg-white shadow-xs">
            <h3 className="text-xs sm:text-sm font-semibold text-[#1c1c1e] tracking-tight mb-3 pb-2 border-b border-slate-100">
              Compliance
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="sm:col-span-2 flex h-10 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.gstRegistered === true}
                  disabled={!isEditing}
                  onChange={(e) => updateField("gstRegistered", e.target.checked)}
                  className="h-4 w-4 accent-red-600"
                />
                GST registered
              </label>
              {[
                ["panNumber", "PAN number"],
                ...(formData.gstRegistered
                  ? [
                      ["gstNumber", "GST number"],
                      ["gstLegalName", "GST legal name"],
                    ]
                  : []),
                ["fssaiNumber", "FSSAI number"],
                ["fssaiExpiry", "FSSAI expiry"],
                ["shopLicenseNumber", "Shop license"],
                ["shopLicenseExpiry", "Shop license expiry"],
              ].map(([key, label]) => {
                const display = pendingField(`documents.${key}`, formData[key]);
                return (
                  <Field
                    key={key}
                    label={label}
                    value={display.liveValue}
                    proposedValue={display.proposedValue}
                    pending={display.pending}
                    editing={isEditing}
                  >
                    <input
                      type={String(key).includes("Expiry") ? "date" : "text"}
                      value={formData[key] || ""}
                      onChange={(e) => updateField(key, e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 grid gap-3 sm:grid-cols-2">
              <ImageField
                label="FSSAI image"
                url={formData.fssaiImage}
                proposedUrl={pendingField("documents.fssaiImage", formData.fssaiImage).proposedValue}
                pending={pendingField("documents.fssaiImage", formData.fssaiImage).pending}
                editing={isEditing}
                uploading={uploadingImageKey === "fssaiImage"}
                onSelect={(e) => handleImageSelect("fssaiImage", e.target.files?.[0])}
              />
              <ImageField
                label="Shop license image"
                url={formData.shopLicenseImage}
                proposedUrl={pendingField("documents.shopLicenseImage", formData.shopLicenseImage).proposedValue}
                pending={pendingField("documents.shopLicenseImage", formData.shopLicenseImage).pending}
                editing={isEditing}
                uploading={uploadingImageKey === "shopLicenseImage"}
                onSelect={(e) => handleImageSelect("shopLicenseImage", e.target.files?.[0])}
              />
            </div>
          </div>

          <div className="p-3.5 sm:p-5 rounded-xl border border-slate-200/80 bg-white shadow-xs">
            <h3 className="text-xs sm:text-sm font-semibold text-[#1c1c1e] tracking-tight mb-3 pb-2 border-b border-slate-100">
              Bank & UPI
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ["bankName", "Bank name"],
                ["accountHolderName", "Account holder"],
                ["accountNumber", "Account number"],
                ["ifscCode", "IFSC code"],
                ["accountType", "Account type"],
                ["upiId", "UPI ID"],
              ].map(([key, label]) => {
                const display = pendingField(`bankInfo.${key}`, formData[key]);
                return (
                  <Field
                    key={key}
                    label={label}
                    value={display.liveValue}
                    proposedValue={display.proposedValue}
                    pending={display.pending}
                    editing={isEditing}
                  >
                    <input
                      value={formData[key] || ""}
                      onChange={(e) => updateField(key, e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100">
              <ImageField
                label="UPI QR image"
                url={formData.upiQrImage}
                proposedUrl={pendingField("bankInfo.upiQrImage", formData.upiQrImage).proposedValue}
                pending={pendingField("bankInfo.upiQrImage", formData.upiQrImage).pending}
                editing={isEditing}
                uploading={uploadingImageKey === "upiQrImage"}
                onSelect={(e) => handleImageSelect("upiQrImage", e.target.files?.[0])}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3.5 sm:space-y-4">
          <div className="p-3.5 sm:p-4 rounded-xl border border-amber-200/70 bg-[#FFFDF5] shadow-xs space-y-3">
            <h4 className="text-xs font-semibold text-amber-900 pb-2 border-b border-amber-200/60">
              Security & Trust
            </h4>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-amber-100/80 flex items-center justify-center shrink-0">
                <Shield className="h-4 w-4 text-amber-700" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#1c1c1e]">Verified seller account</p>
                <p className="text-[11px] text-slate-500">Keep docs and bank details up to date.</p>
              </div>
            </div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200/80 bg-white shadow-xs space-y-3">
            <h4 className="text-xs font-semibold text-[#1c1c1e] pb-2 border-b border-slate-100">Account</h4>
            <button
              type="button"
              onClick={logout}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-xs"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete account
            </button>
          </div>
        </div>
      </div>

      {showDeleteConfirm ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl border border-slate-200">
            <div className="mb-2 flex items-center gap-2.5 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-sm font-semibold text-[#1c1c1e]">Delete seller account?</h3>
            </div>
            <p className="text-xs font-normal text-slate-500 leading-relaxed">
              This disables your shop and catalog listings. Transaction records remain archived.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 px-3 py-1.5 bg-white text-slate-600 border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-50"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Keep it
              </button>
              <button
                type="button"
                className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold disabled:opacity-70"
                onClick={handleDeleteAccount}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isMapOpen ? (
        <MapPicker
          isOpen={isMapOpen}
          onClose={() => setIsMapOpen(false)}
          onConfirm={handleLocationSelect}
          initialLocation={initialLocation}
          zoneCoordinates={selectedZone?.coordinates || []}
          zoneLabel={selectedZone?.label || formData.zoneName || ""}
        />
      ) : null}
    </div>
  );
}

export default SellerProfile;
