import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  Store,
  Shield,
  Edit2,
  Save,
  X,
  Rocket,
  Globe,
  MapPin,
  UploadCloud,
  ArrowLeft,
} from "lucide-react";
import { sellerApi } from "../services/sellerApi";
import { adminApi } from "../../quickCommerce/admin/services/adminApi";
import { toast } from "sonner";
import Card from "@shared/components/ui/Card";
import Button from "@shared/components/ui/Button";
import MapPicker from "../../../shared/components/MapPicker";

const SellerProfile = ({ asAdmin = false, adminSellerId = null, onBack = null, onProfileLoad = null, children = null }) => {
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocationSaving, setIsLocationSaving] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    shopName: "",
    phone: "",
    email: "",
    lat: null,
    lng: null,
    radius: 5,
    address: "",
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
  });

  const [qrFile, setQrFile] = useState(null);
  const [qrPreview, setQrPreview] = useState(null);
  const [licenseFile, setLicenseFile] = useState(null);
  const [licensePreview, setLicensePreview] = useState(null);
  const [panFile, setPanFile] = useState(null);
  const [panPreview, setPanPreview] = useState(null);
  const [gstFile, setGstFile] = useState(null);
  const [gstPreview, setGstPreview] = useState(null);
  const [fssaiFile, setFssaiFile] = useState(null);
  const [fssaiPreview, setFssaiPreview] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      let data = null;
      if (asAdmin && adminSellerId) {
        const response = await adminApi.getSellerRequests({ status: "approved", limit: 500 });
        const items = response?.data?.result?.items || response?.data?.data?.items || response?.data?.result || [];
        data = Array.isArray(items) ? items.find((item) => String(item._id || item.id) === String(adminSellerId)) : null;
        if (!data) {
          toast.error("Seller not found");
          setIsLoading(false);
          return;
        }
      } else {
        const sellerToken = localStorage.getItem("auth_seller");
        if (!sellerToken) {
          setIsLoading(false);
          return;
        }
        const response = await sellerApi.getProfile();
        data = response.data.result;
      }
      setProfile(data);
      if (onProfileLoad) onProfileLoad(data);
      setFormData({
        name: data.name,
        shopName: data.shopName,
        phone: data.phone,
        email: data.email,
        lat: (data.location?.coordinates && data.location.coordinates[1] !== undefined) ? data.location.coordinates[1] : null,
        lng: (data.location?.coordinates && data.location.coordinates[0] !== undefined) ? data.location.coordinates[0] : null,
        radius: data.serviceRadius || 5,
        address: data.address || "",
        bankName: data.bankInfo?.bankName || "",
        accountHolderName: data.bankInfo?.accountHolderName || "",
        accountNumber: data.bankInfo?.accountNumber || "",
        ifscCode: data.bankInfo?.ifscCode || "",
        accountType: data.bankInfo?.accountType || "",
        upiId: data.bankInfo?.upiId || "",
        panNumber: data.documents?.panNumber || "",
        gstRegistered: data.documents?.gstRegistered || false,
        gstNumber: data.documents?.gstNumber || "",
        gstLegalName: data.documents?.gstLegalName || "",
        fssaiNumber: data.documents?.fssaiNumber || "",
        fssaiExpiry: data.documents?.fssaiExpiry ? new Date(data.documents.fssaiExpiry).toISOString().split('T')[0] : "",
        shopLicenseNumber: data.documents?.shopLicenseNumber || "",
        shopLicenseExpiry: data.documents?.shopLicenseExpiry ? new Date(data.documents.shopLicenseExpiry).toISOString().split('T')[0] : "",
      });
      if (data.bankInfo?.upiQrImage) setQrPreview(data.bankInfo.upiQrImage);
      if (data.documents?.shopLicenseImage) setLicensePreview(data.documents.shopLicenseImage);
      if (data.documents?.panImage) setPanPreview(data.documents.panImage);
      if (data.documents?.gstImage) setGstPreview(data.documents.gstImage);
      if (data.documents?.fssaiImage) setFssaiPreview(data.documents.fssaiImage);
    } catch (error) {
      if (error?.response?.status !== 401) {
        toast.error("Failed to fetch profile");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const syncLocationProfileState = (location) => {
    setFormData((prev) => ({
      ...prev,
      lat: location.lat,
      lng: location.lng,
      radius: location.radius,
      address: location.address || location.formattedAddress || "",
    }));
  };

  const handleLocationSelect = async (location) => {
    const nextLocation = {
      lat: location.lat,
      lng: location.lng,
      radius: location.radius,
      address: location.address || location.formattedAddress || "",
    };

    syncLocationProfileState(nextLocation);
    setIsLocationSaving(true);

    try {
      await sellerApi.updateProfile(nextLocation);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              serviceRadius: nextLocation.radius,
              address: nextLocation.address,
              location: {
                ...(prev.location || {}),
                type: "Point",
                coordinates: [nextLocation.lng, nextLocation.lat],
                latitude: nextLocation.lat,
                longitude: nextLocation.lng,
                formattedAddress: nextLocation.address,
                address: nextLocation.address,
              },
            }
          : prev,
      );
      toast.success("Location updated successfully");
      await fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update location");
      fetchProfile();
    } finally {
      setIsLocationSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "name") {
      // Disallow numbers in seller name
      const cleaned = value.replace(/[0-9]/g, "");
      setFormData({ ...formData, [name]: cleaned });
    } else if (name === "phone") {
      // Allow only digits, max 10 characters
      const digitsOnly = value.replace(/[^0-9]/g, "").slice(0, 10);
      setFormData({ ...formData, [name]: digitsOnly });
    } else if (name === "email") {
      // Trim spaces, keep as-is otherwise; HTML5 type=email will help validate shape
      setFormData({ ...formData, [name]: value.trimStart() });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const initialLocation = useMemo(
    () => (formData.lat ? { lat: formData.lat, lng: formData.lng } : null),
    [formData.lat, formData.lng],
  );

  const handleSubmit = async (e) => {
    e?.preventDefault?.();

    const normalizedPhone = String(formData.phone || "")
      .replace(/[^0-9]/g, "")
      .slice(-10);
    const trimmedEmail = String(formData.email || "").trim().toLowerCase();

    // Seller phone is required, but email is optional in the backend model.
    if (!/^[0-9]{10}$/.test(normalizedPhone)) {
      toast.error("Please enter a valid 10-digit phone number.");
      return;
    }

    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (formData.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panNumber)) {
      toast.error("Invalid PAN format. Must be 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)");
      return;
    }

    if (formData.gstRegistered) {
      if (!formData.gstNumber || !formData.gstLegalName) {
        toast.error("GST number and GST legal name are required when GST is registered");
        return;
      }
      if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(formData.gstNumber)) {
        toast.error("Invalid GST format. Must be 15 characters (e.g. 22ABCDE1234F1Z5)");
        return;
      }
    }

    if (formData.fssaiExpiry && formData.fssaiExpiry < new Date().toISOString().split("T")[0]) {
      toast.error("FSSAI expiry date cannot be a past date");
      return;
    }

    if (formData.shopLicenseNumber && !/^[A-Za-z0-9\/\-]{5,20}$/.test(formData.shopLicenseNumber)) {
      toast.error("Shop license number must be 5–20 characters (letters, numbers, / and - only)");
      return;
    }

    if (formData.shopLicenseExpiry && formData.shopLicenseExpiry < new Date().toISOString().split("T")[0]) {
      toast.error("Shop license expiry date cannot be a past date");
      return;
    }

    if (formData.accountNumber && !/^\d{6,20}$/.test(formData.accountNumber)) {
      toast.error("Account number must be 6–20 digits (numbers only)");
      return;
    }

    if (formData.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.ifscCode)) {
      toast.error("Invalid IFSC code. Format: 4 letters + 0 + 6 alphanumeric (e.g. ABCD0EF1234)");
      return;
    }

    if (formData.upiId && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(formData.upiId)) {
      toast.error("Invalid UPI ID. Format: username@bankhandle (e.g. name@okhdfcbank)");
      return;
    }

    setIsSaving(true);
    try {
      const payload = new FormData();
      const finalForm = {
        ...formData,
        phone: normalizedPhone,
        email: trimmedEmail,
        ...(formData.gstRegistered === false && {
          gstNumber: "",
          gstLegalName: "",
        }),
      };
      
      Object.entries(finalForm).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          payload.append(
            key,
            typeof value === "boolean" ? String(value) : String(value)
          );
        }
      });

      if (qrFile) payload.append("upiQrImage", qrFile);
      if (licenseFile) payload.append("shopLicenseImage", licenseFile);
      if (panFile) payload.append("panImage", panFile);
      if (gstFile) payload.append("gstImage", gstFile);
      if (fssaiFile) payload.append("fssaiImage", fssaiFile);

      if (asAdmin && adminSellerId) {
        await adminApi.updateSellerProfile(adminSellerId, payload);
      } else {
        await sellerApi.updateProfile(payload);
      }
      toast.success("Profile updated successfully");
      setIsEditing(false);
      await fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-6 md:px-8 py-4 font-['Outfit']">
      {/* Header Section */}
      <div className="relative mb-8 sm:mb-12 md:mb-24">
        {/* MOBILE HEADER (Unified Dark Card, no empty black rectangle!) */}
        <div className="md:hidden bg-gradient-to-br from-slate-900 via-slate-950 to-black rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-slate-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
          </div>

          {/* Avatar Inside Card */}
          <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-full bg-white p-1.5 shadow-[0_15px_40px_rgba(0,0,0,0.4)] relative z-10 mb-4">
            <div className="h-full w-full rounded-full bg-slate-50 flex items-center justify-center border-4 border-slate-100">
              <span className="text-5xl sm:text-6xl font-black text-slate-900">
                {profile?.name?.charAt(0) || "S"}
              </span>
            </div>
          </div>

          {/* Badges Inside Card */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 mb-3 relative z-10">
            <span className="px-3.5 py-1 bg-white/10 backdrop-blur-xl text-white text-[10px] font-black uppercase tracking-[2px] rounded-full border border-white/20">
              {profile?.role || "SELLER"}
            </span>
            <span
              className={`px-3.5 py-1 text-[10px] font-black uppercase tracking-[2px] rounded-full border ${
                profile?.isActive !== false
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-red-500/10 text-red-400 border-red-500/20"
              }`}
            >
              {profile?.isActive !== false ? "Active" : "Inactive"}
            </span>
          </div>

          {/* Name & Shop Inside Card */}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="absolute top-6 left-6 z-20 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-md transition hover:bg-white/20 border border-white/20"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow-sm mb-1 relative z-10">
            {profile?.name || "Seller Profile"}
          </h1>
          <p className="text-white/70 font-bold tracking-wide text-sm sm:text-base mb-6 relative z-10">
            {profile?.shopName || "My Store"}
          </p>

          {/* Action Button Inside Card */}
          <div className="w-full max-w-sm relative z-10">
            {!isEditing ? (
              <Button
                type="button"
                onClick={() => setIsEditing(true)}
                className="w-full bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white hover:text-slate-950 transition-all rounded-xl px-6 py-4 flex items-center justify-center gap-3 font-black tracking-[2px] text-xs shadow-lg"
              >
                <Edit2 size={16} /> EDIT PROFILE
              </Button>
            ) : (
              <div className="flex gap-3 w-full">
                <Button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  variant="outline"
                  className="h-12 w-12 flex items-center justify-center bg-white/10 text-white border border-white/20 hover:bg-white hover:text-slate-900 rounded-xl shadow-lg transition-all backdrop-blur-md flex-shrink-0"
                >
                  <X size={20} className="stroke-[2.5]" />
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSaving}
                  className="flex-1 bg-white text-slate-950 hover:bg-slate-100 rounded-xl px-6 py-4 font-black tracking-[2px] text-xs flex items-center justify-center gap-2 shadow-lg h-12"
                >
                  {isSaving ? "UPDATING..." : (
                    <>
                      <Save size={18} /> SAVE CHANGES
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* DESKTOP HEADER (Exact same structure that looks perfect on Web View!) */}
        <div className="hidden md:block">
          <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-black h-64 rounded-3xl shadow-xl relative overflow-hidden">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
              <div className="absolute bottom-0 right-0 w-96 h-96 bg-slate-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
            </div>
            {/* Desktop internal text */}
            <div className="absolute bottom-8 left-64 pl-6 right-12 flex items-end justify-between gap-6 z-10">
              <div className="flex-1 pb-2 flex items-center gap-4">
                {onBack && (
                  <button
                    type="button"
                    onClick={onBack}
                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-md transition hover:bg-white/20 border border-white/20 flex-shrink-0"
                  >
                    <ArrowLeft size={24} />
                  </button>
                )}
                <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-3.5 py-1 bg-white/10 backdrop-blur-xl text-white text-[10px] font-black uppercase tracking-[2px] rounded-full border border-white/20">
                    {profile?.role || "SELLER"}
                  </span>
                  <span
                    className={`px-3.5 py-1 text-[10px] font-black uppercase tracking-[2px] rounded-full border ${
                      profile?.isActive !== false
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-red-500/10 text-red-400 border-red-500/20"
                    }`}
                    style={{ backdropFilter: "blur(12px)" }}
                  >
                    {profile?.isActive !== false ? "Active" : "Inactive"}
                  </span>
                </div>
                <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tight drop-shadow-sm mb-1 truncate">
                  {profile?.name || "Seller Profile"}
                </h1>
                <p className="text-white/70 font-bold tracking-wide text-base">
                  {profile?.shopName || "My Store"}
                </p>
              </div>
              </div>
              <div className="pb-2 flex-shrink-0">
                {!isEditing ? (
                  <Button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white hover:text-slate-950 transition-all rounded-xl px-8 py-4 flex items-center gap-3 font-black tracking-[2px] text-xs shadow-lg hover:scale-[1.03] active:scale-[0.98]"
                  >
                    <Edit2 size={16} /> EDIT PROFILE
                  </Button>
                ) : (
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      variant="outline"
                      className="h-14 w-14 flex items-center justify-center bg-white/10 text-white border border-white/20 hover:bg-white hover:text-slate-900 rounded-xl shadow-lg transition-all backdrop-blur-md"
                    >
                      <X size={22} className="stroke-[2.5]" />
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSaving}
                      className="bg-white text-slate-950 hover:bg-slate-100 rounded-xl px-8 py-4 font-black tracking-[2px] text-xs flex items-center gap-3 shadow-lg h-14"
                    >
                      {isSaving ? "UPDATING..." : (
                        <>
                          <Save size={18} /> SAVE CHANGES
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Desktop Avatar Container (Absolute over left edge of banner) */}
          <div className="absolute bottom-6 left-12 z-20 flex flex-col items-center">
            <div className="h-44 w-44 rounded-full bg-white p-2 shadow-[0_20px_60px_rgba(0,0,0,0.2)] flex-shrink-0">
              <div className="h-full w-full rounded-full bg-slate-50 flex items-center justify-center border-4 border-slate-100">
                <span className="text-7xl font-black text-slate-900">
                  {profile?.name?.charAt(0) || "S"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Main Info Card */}
        <div className="lg:col-span-2 space-y-6 sm:space-y-8">
          <Card className="p-5 sm:p-8 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-2xl sm:rounded-3xl">
            <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-6 sm:mb-8 border-b border-slate-50 pb-4">
              Business Profile
            </h3>

            <form className="space-y-6 sm:space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-8">
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    Seller Identity
                  </label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors">
                      <User size={18} />
                    </div>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    Store Name
                  </label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors">
                      <Store size={18} />
                    </div>
                    <input
                      type="text"
                      name="shopName"
                      value={formData.shopName}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    Contact Number
                  </label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors">
                      <Phone size={18} />
                    </div>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    User Id
                  </label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300">
                      <Mail size={18} />
                    </div>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70"
                    />
                  </div>
                </div>
              </div>
            </form>
          </Card>

          {/* Location & Radius Settings Card */}
          <Card className="p-5 sm:p-8 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-2xl sm:rounded-3xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8 border-b border-slate-50 pb-4">
              <h3 className="text-lg sm:text-xl font-black text-slate-900">
                Location & Service Settings
              </h3>
              {!isEditing && (
                <Button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="bg-primary-orange text-white hover:bg-primary-hover active:bg-primary-dark rounded-lg px-6 py-2 text-[10px] font-black tracking-[2px] transition-colors">
                  MANAGE
                </Button>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border-2 border-slate-100/50 space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                    <div
                      className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                        formData.lat
                          ? "bg-emerald-100 text-emerald-600 shadow-[0_8px_20px_-6px_rgba(16,185,129,0.3)]"
                          : "bg-white text-slate-400 shadow-sm"
                      }`}>
                      <MapPin size={24} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-black text-slate-900">
                        {formData.lat
                          ? "Store Location Pin"
                          : "Location Not Defined"}
                      </p>
                      <p className="text-xs text-slate-500 font-medium max-w-[400px] leading-relaxed">
                        {formData.address ||
                          "Click change to precisely mark your shop location on the map for delivery accuracy."}
                      </p>
                    </div>
                  </div>
                  {isEditing && (
                    <Button
                      type="button"
                      onClick={() => setIsMapOpen(true)}
                      disabled={isLocationSaving}
                      className="w-full sm:w-auto bg-white text-slate-900 border-2 border-slate-200 hover:border-slate-900 rounded-lg px-6 sm:px-8 py-3 text-[10px] font-black tracking-[2px] shadow-sm hover:shadow-md transition-all whitespace-nowrap">
                      {isLocationSaving ? "UPDATING..." : "CHANGE PIN"}
                    </Button>
                  )}
                </div>

                {formData.lat !== null && formData.lat !== undefined && (
                  <div className="pt-6 border-t border-slate-200/60 grid grid-cols-2 sm:flex sm:flex-wrap gap-4 sm:gap-8">
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                        Latitude
                      </span>
                      <span className="text-sm font-bold text-slate-700 tabular-nums">
                        {formData.lat.toFixed(6)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                        Longitude
                      </span>
                      <span className="text-sm font-bold text-slate-700 tabular-nums">
                        {formData.lng.toFixed(6)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
                <Shield size={16} className="text-amber-600 mt-0.5" />
                <p className="text-xs text-amber-700 font-medium leading-relaxed">
                  Your shop location determines which
                  customers can view your products. Ensure the marker is placed
                  exactly at your physical storefront for accurate delivery
                  assignments.
                </p>
              </div>
            </div>
          </Card>

          {/* Banking & UPI Card */}
          <Card className="p-5 sm:p-8 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-2xl sm:rounded-3xl mt-6 sm:mt-8">
            <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-6 sm:mb-8 border-b border-slate-50 pb-4">
              Banking & UPI
            </h3>
            <div className="space-y-6 sm:space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-8">
                {/* Bank Name */}
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">Bank Name</label>
                  <input type="text" name="bankName" value={formData.bankName} onChange={handleChange} disabled={!isEditing} className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70" />
                </div>
                {/* Account Holder Name */}
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">Account Holder Name</label>
                  <input type="text" name="accountHolderName" value={formData.accountHolderName} onChange={handleChange} disabled={!isEditing} className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70" />
                </div>
                {/* Account Number */}
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">Account Number</label>
                  <input type="text" name="accountNumber" value={formData.accountNumber} onChange={(e) => setFormData({...formData, accountNumber: e.target.value.replace(/\D/g, "").slice(0, 20)})} disabled={!isEditing} className={`w-full px-5 py-4 bg-slate-50 border-2 rounded-lg text-sm font-bold text-slate-700 outline-none transition-all disabled:opacity-70 ${isEditing && formData.accountNumber && !/^\d{6,20}$/.test(formData.accountNumber) ? "border-red-400 bg-red-50 focus:bg-red-50 focus:border-red-500" : "border-transparent focus:bg-white focus:border-slate-100"}`} />
                  {isEditing && formData.accountNumber && !/^\d{6,20}$/.test(formData.accountNumber) && (
                    <p className="text-[10px] font-black text-red-500 ml-1">Must be 6–20 digits</p>
                  )}
                </div>
                {/* IFSC Code */}
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">IFSC Code</label>
                  <input type="text" name="ifscCode" value={formData.ifscCode} onChange={(e) => setFormData({...formData, ifscCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11)})} disabled={!isEditing} className={`w-full px-5 py-4 bg-slate-50 border-2 rounded-lg text-sm font-bold text-slate-700 outline-none transition-all disabled:opacity-70 ${isEditing && formData.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.ifscCode) ? "border-red-400 bg-red-50 focus:bg-red-50 focus:border-red-500" : "border-transparent focus:bg-white focus:border-slate-100"}`} />
                  {isEditing && formData.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.ifscCode) && (
                    <p className="text-[10px] font-black text-red-500 ml-1">Invalid IFSC format</p>
                  )}
                </div>
                {/* Account Type */}
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">Account Type</label>
                  <select name="accountType" value={formData.accountType} onChange={handleChange} disabled={!isEditing} className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70 appearance-none">
                    <option value="">Select type</option>
                    <option value="Savings">Savings Account</option>
                    <option value="Current">Current Account</option>
                  </select>
                </div>
                {/* UPI ID */}
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">UPI ID</label>
                  <input type="text" name="upiId" value={formData.upiId} onChange={handleChange} disabled={!isEditing} className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70" />
                </div>
              </div>
              {/* UPI QR Code */}
              <div className="space-y-3 pt-4 border-t border-slate-50">
                <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">UPI QR Code</label>
                {isEditing ? (
                  <div className="flex flex-col items-start gap-4">
                    {qrPreview && <img src={qrPreview} alt="UPI QR" className="h-32 w-32 object-contain rounded-xl border-2 border-slate-100" />}
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg text-xs transition-colors">
                      <UploadCloud size={16} /> Upload New QR
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setQrFile(file);
                          setQrPreview(URL.createObjectURL(file));
                        }
                      }} />
                    </label>
                  </div>
                ) : (
                  <div>
                    {qrPreview ? (
                      <img src={qrPreview} alt="UPI QR" className="h-32 w-32 object-contain rounded-xl border-2 border-slate-100" />
                    ) : (
                      <p className="text-sm font-bold text-slate-400">No QR Code uploaded</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Compliance & Licenses Card */}
          <Card className="p-5 sm:p-8 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-2xl sm:rounded-3xl mt-6 sm:mt-8">
            <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-6 sm:mb-8 border-b border-slate-50 pb-4">
              Compliance & Licenses
            </h3>
            <div className="space-y-6 sm:space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-8">
                {/* PAN Number */}
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">PAN Number</label>
                  <input type="text" name="panNumber" value={formData.panNumber} onChange={(e) => setFormData({...formData, panNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)})} disabled={!isEditing} className={`w-full px-5 py-4 bg-slate-50 border-2 rounded-lg text-sm font-bold text-slate-700 outline-none transition-all disabled:opacity-70 ${isEditing && formData.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panNumber) ? "border-red-400 bg-red-50 focus:bg-red-50 focus:border-red-500" : "border-transparent focus:bg-white focus:border-slate-100"}`} />
                  {isEditing && formData.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panNumber) && (
                    <p className="text-[10px] font-black text-red-500 ml-1">Invalid PAN format</p>
                  )}
                </div>
                
                {/* GST Logic */}
                <div className="space-y-3 sm:col-span-2">
                  <label className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 w-fit cursor-pointer disabled:opacity-70">
                    <input type="checkbox" checked={formData.gstRegistered} onChange={(e) => setFormData({...formData, gstRegistered: e.target.checked})} disabled={!isEditing} className="accent-slate-900 w-4 h-4 disabled:opacity-70" />
                    <span className="text-xs font-black uppercase tracking-widest text-slate-700">GST Registered</span>
                  </label>
                </div>
                
                {formData.gstRegistered && (
                  <>
                    {/* GST Number */}
                    <div className="space-y-3">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">GST Number</label>
                      <input type="text" name="gstNumber" value={formData.gstNumber} onChange={(e) => setFormData({...formData, gstNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15)})} disabled={!isEditing} className={`w-full px-5 py-4 bg-slate-50 border-2 rounded-lg text-sm font-bold text-slate-700 outline-none transition-all disabled:opacity-70 ${isEditing && formData.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(formData.gstNumber) ? "border-red-400 bg-red-50 focus:bg-red-50 focus:border-red-500" : "border-transparent focus:bg-white focus:border-slate-100"}`} />
                      {isEditing && formData.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(formData.gstNumber) && (
                        <p className="text-[10px] font-black text-red-500 ml-1">Invalid GST format</p>
                      )}
                    </div>
                    {/* GST Legal Name */}
                    <div className="space-y-3">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">GST Legal Name</label>
                      <input type="text" name="gstLegalName" value={formData.gstLegalName} onChange={(e) => setFormData({...formData, gstLegalName: e.target.value.replace(/[^a-zA-Z\s]/g, "")})} disabled={!isEditing} className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70" />
                    </div>
                  </>
                )}

                {/* FSSAI Number */}
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">FSSAI Number</label>
                  <input type="text" name="fssaiNumber" value={formData.fssaiNumber} onChange={(e) => setFormData({...formData, fssaiNumber: e.target.value.replace(/\D/g, "").slice(0, 14)})} disabled={!isEditing} className={`w-full px-5 py-4 bg-slate-50 border-2 rounded-lg text-sm font-bold text-slate-700 outline-none transition-all disabled:opacity-70 ${isEditing && formData.fssaiNumber && !/^\d{14}$/.test(formData.fssaiNumber) ? "border-red-400 bg-red-50 focus:bg-red-50 focus:border-red-500" : "border-transparent focus:bg-white focus:border-slate-100"}`} />
                  {isEditing && formData.fssaiNumber && !/^\d{14}$/.test(formData.fssaiNumber) && (
                    <p className="text-[10px] font-black text-red-500 ml-1">Must be exactly 14 digits</p>
                  )}
                </div>
                {/* FSSAI Expiry */}
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">FSSAI Expiry Date</label>
                  <input type="date" name="fssaiExpiry" value={formData.fssaiExpiry} min={new Date().toISOString().split("T")[0]} onChange={handleChange} disabled={!isEditing} className={`w-full px-5 py-4 bg-slate-50 border-2 rounded-lg text-sm font-bold text-slate-700 outline-none transition-all disabled:opacity-70 ${isEditing && formData.fssaiExpiry && formData.fssaiExpiry < new Date().toISOString().split("T")[0] ? "border-red-400 bg-red-50 focus:bg-red-50 focus:border-red-500" : "border-transparent focus:bg-white focus:border-slate-100"}`} />
                </div>

                {/* Shop License Number */}
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">Shop License Number</label>
                  <input type="text" name="shopLicenseNumber" value={formData.shopLicenseNumber} onChange={(e) => setFormData({...formData, shopLicenseNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9\/\-]/g, "").slice(0, 20)})} disabled={!isEditing} className={`w-full px-5 py-4 bg-slate-50 border-2 rounded-lg text-sm font-bold text-slate-700 outline-none transition-all disabled:opacity-70 ${isEditing && formData.shopLicenseNumber && !/^[A-Z0-9\/\-]{5,20}$/.test(formData.shopLicenseNumber) ? "border-red-400 bg-red-50 focus:bg-red-50 focus:border-red-500" : "border-transparent focus:bg-white focus:border-slate-100"}`} />
                  {isEditing && formData.shopLicenseNumber && !/^[A-Z0-9\/\-]{5,20}$/.test(formData.shopLicenseNumber) && (
                    <p className="text-[10px] font-black text-red-500 ml-1">Must be 5-20 characters</p>
                  )}
                </div>
                {/* Shop License Expiry */}
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">Shop License Expiry Date</label>
                  <input type="date" name="shopLicenseExpiry" value={formData.shopLicenseExpiry} min={new Date().toISOString().split("T")[0]} onChange={handleChange} disabled={!isEditing} className={`w-full px-5 py-4 bg-slate-50 border-2 rounded-lg text-sm font-bold text-slate-700 outline-none transition-all disabled:opacity-70 ${isEditing && formData.shopLicenseExpiry && formData.shopLicenseExpiry < new Date().toISOString().split("T")[0] ? "border-red-400 bg-red-50 focus:bg-red-50 focus:border-red-500" : "border-transparent focus:bg-white focus:border-slate-100"}`} />
                </div>
              </div>

              {/* PAN Image */}
              <div className="space-y-3 pt-4 border-t border-slate-50">
                <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">PAN Document Image</label>
                {isEditing ? (
                  <div className="flex flex-col items-start gap-4">
                    {panPreview && <img src={panPreview} alt="PAN Document" className="h-32 w-48 object-contain rounded-xl border-2 border-slate-100" />}
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg text-xs transition-colors">
                      <UploadCloud size={16} /> Upload New PAN
                      <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setPanFile(file);
                          setPanPreview(URL.createObjectURL(file));
                        }
                      }} />
                    </label>
                  </div>
                ) : (
                  <div>
                    {panPreview ? (
                      <img src={panPreview} alt="PAN Document" className="h-32 w-48 object-contain rounded-xl border-2 border-slate-100" />
                    ) : (
                      <p className="text-sm font-bold text-slate-400">No Document uploaded</p>
                    )}
                  </div>
                )}
              </div>

              {/* GST Image */}
              {formData.gstRegistered && (
                <div className="space-y-3 pt-4 border-t border-slate-50">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">GST Certificate Image</label>
                  {isEditing ? (
                    <div className="flex flex-col items-start gap-4">
                      {gstPreview && <img src={gstPreview} alt="GST Certificate" className="h-32 w-48 object-contain rounded-xl border-2 border-slate-100" />}
                      <label className="flex items-center gap-2 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg text-xs transition-colors">
                        <UploadCloud size={16} /> Upload New GST Certificate
                        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setGstFile(file);
                            setGstPreview(URL.createObjectURL(file));
                          }
                        }} />
                      </label>
                    </div>
                  ) : (
                    <div>
                      {gstPreview ? (
                        <img src={gstPreview} alt="GST Certificate" className="h-32 w-48 object-contain rounded-xl border-2 border-slate-100" />
                      ) : (
                        <p className="text-sm font-bold text-slate-400">No Document uploaded</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* FSSAI Image */}
              <div className="space-y-3 pt-4 border-t border-slate-50">
                <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">FSSAI License Image</label>
                {isEditing ? (
                  <div className="flex flex-col items-start gap-4">
                    {fssaiPreview && <img src={fssaiPreview} alt="FSSAI License" className="h-32 w-48 object-contain rounded-xl border-2 border-slate-100" />}
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg text-xs transition-colors">
                      <UploadCloud size={16} /> Upload New FSSAI License
                      <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setFssaiFile(file);
                          setFssaiPreview(URL.createObjectURL(file));
                        }
                      }} />
                    </label>
                  </div>
                ) : (
                  <div>
                    {fssaiPreview ? (
                      <img src={fssaiPreview} alt="FSSAI License" className="h-32 w-48 object-contain rounded-xl border-2 border-slate-100" />
                    ) : (
                      <p className="text-sm font-bold text-slate-400">No Document uploaded</p>
                    )}
                  </div>
                )}
              </div>

              {/* Shop License Image */}
              <div className="space-y-3 pt-4 border-t border-slate-50">
                <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">Shop License Document</label>
                {isEditing ? (
                  <div className="flex flex-col items-start gap-4">
                    {licensePreview && <img src={licensePreview} alt="Shop License" className="h-32 w-48 object-contain rounded-xl border-2 border-slate-100" />}
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg text-xs transition-colors">
                      <UploadCloud size={16} /> Upload New License
                      <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setLicenseFile(file);
                          setLicensePreview(URL.createObjectURL(file));
                        }
                      }} />
                    </label>
                  </div>
                ) : (
                  <div>
                    {licensePreview ? (
                      <img src={licensePreview} alt="Shop License" className="h-32 w-48 object-contain rounded-xl border-2 border-slate-100" />
                    ) : (
                      <p className="text-sm font-bold text-slate-400">No Document uploaded</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6 sm:space-y-8">
          <Card className="p-5 sm:p-8 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-2xl sm:rounded-[40px] bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-800 text-white">
            <h4 className="text-[10px] font-black uppercase tracking-[4px] text-white/40 mb-6">
              Security & Trust
            </h4>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Shield size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-white/60">
                    Verification
                  </p>
                  <p className="text-sm font-bold">
                    {profile?.isVerified
                      ? "Verified Merchant"
                      : "Verification Pending"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Rocket size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-white/60">
                    Partner Tier
                  </p>
                  <p className="text-sm font-bold">Standard Growth</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Globe size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-white/60">
                    Region
                  </p>
                  <p className="text-sm font-bold">Pan India Reach</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {isMapOpen && (
        <MapPicker
          isOpen={isMapOpen}
          onClose={() => setIsMapOpen(false)}
          onConfirm={handleLocationSelect}
          initialLocation={initialLocation}
          initialRadius={formData.radius}
        />
      )}
    </div>
  );
};

export default SellerProfile;
