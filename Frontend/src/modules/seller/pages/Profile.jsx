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
  CheckCircle,
} from "lucide-react";
import { sellerApi } from "../services/sellerApi";
import { toast } from "sonner";
import Card from "@shared/components/ui/Card";
import Button from "@shared/components/ui/Button";
import MapPicker from "../../../shared/components/MapPicker";

const SellerProfile = () => {
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
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const sellerToken = localStorage.getItem("auth_seller");
    if (!sellerToken) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await sellerApi.getProfile();
      const data = response.data.result;
      setProfile(data);
      setFormData({
        name: data.name,
        shopName: data.shopName,
        phone: data.phone,
        email: data.email,
        lat: (data.location?.coordinates && data.location.coordinates[1] !== undefined) ? data.location.coordinates[1] : null,
        lng: (data.location?.coordinates && data.location.coordinates[0] !== undefined) ? data.location.coordinates[0] : null,
        radius: data.serviceRadius || 5,
        address: data.address || "",
      });
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

    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        phone: normalizedPhone,
        email: trimmedEmail,
        lat: formData.lat,
        lng: formData.lng,
        radius: formData.radius,
      };
      await sellerApi.updateProfile(payload);
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
              <div className="flex-1 pb-2">
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
                  className="bg-slate-900 text-white hover:bg-black rounded-lg px-6 py-2 text-[10px] font-black tracking-[2px]">
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
                        Service Radius
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-slate-900">
                          {formData.radius}
                        </span>
                        <span className="text-xs font-bold text-slate-500 bg-slate-200/50 px-2 py-0.5 rounded-md">
                          KM
                        </span>
                      </div>
                    </div>
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
                  Your shop location and service radius determine which
                  customers can view your products. Ensure the marker is placed
                  exactly at your physical storefront for accurate delivery
                  assignments.
                </p>
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
