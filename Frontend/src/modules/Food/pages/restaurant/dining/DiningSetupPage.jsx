import { useEffect, useState } from "react";
import { Loader2, Save, Send, X, ImagePlus, UtensilsCrossed, Clock, Tag, IndianRupee, FileText } from "lucide-react";
import { toast } from "sonner";
import { restaurantAPI, diningAPI, uploadAPI } from "@food/api";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LABELS = { Sun: "Sunday", Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday" };

function defaultSlots() {
  return DAY_NAMES.map((day) => ({
    day, isOpen: false, openingTime: "12:00", closingTime: "22:00", slotDurationMinutes: 60, capacityPerSlot: 0,
  }));
}

function SectionCard({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0D315B]/10 text-[#0D315B]">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

export default function DiningSetupPage() {
  const [profile, setProfile] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [description, setDescription] = useState("");
  const [avgCostForTwo, setAvgCostForTwo] = useState(0);
  const [ambienceImages, setAmbienceImages] = useState([]);
  const [categoryIds, setCategoryIds] = useState([]);
  const [slots, setSlots] = useState(defaultSlots());

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [profileRes, catRes] = await Promise.all([
        restaurantAPI.getDiningProfile(),
        diningAPI.getCategories().catch(() => null),
      ]);
      const p = profileRes?.data?.data?.profile;
      setProfile(p);
      if (p) {
        setDescription(p.description || "");
        setAvgCostForTwo(p.avgCostForTwo || 0);
        setAmbienceImages(p.ambienceImages || []);
        setCategoryIds((p.categoryIds || []).map((c) => (typeof c === "string" ? c : c._id)));
        if (p.slots?.length) setSlots(p.slots);
      }
      setCategories(catRes?.data?.data?.categories || []);
    } catch {
      toast.error("Failed to load dining setup");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleRequest = async () => {
    try {
      setRequesting(true);
      await restaurantAPI.requestDining();
      toast.success("Dining request submitted for review");
      fetchAll();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to submit request");
    } finally {
      setRequesting(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const res = await uploadAPI.uploadMedia(file, { folder: "appzeto/dining" });
      const payload = res?.data?.data || res?.data;
      if (payload?.url) setAmbienceImages((prev) => [...prev, payload.url]);
    } catch {
      toast.error("Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const updateSlot = (index, field, value) => {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const toggleCategory = (id) => {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const handleSaveSetup = async () => {
    try {
      setSaving(true);
      const res = await restaurantAPI.updateDiningSetup({
        description, avgCostForTwo: Number(avgCostForTwo), ambienceImages, categoryIds, slots,
      });
      setProfile(res?.data?.data?.profile);
      toast.success("Dining setup saved");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save setup");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async () => {
    try {
      setToggling(true);
      const res = await restaurantAPI.toggleDiningEnabled(!profile?.isDiningEnabled);
      setProfile(res?.data?.data?.profile);
      toast.success(res?.data?.data?.profile?.isDiningEnabled ? "Dining enabled" : "Dining disabled");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update dining status");
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!profile || profile.status === "not_requested" || profile.status === "rejected") {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center p-6 text-center">
        <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0D315B]/10 text-[#0D315B]">
          <UtensilsCrossed className="h-7 w-7" />
        </span>
        <h1 className="mb-2 text-xl font-bold text-gray-900">Enable Dine-In Bookings</h1>
        <p className="mb-6 text-sm text-gray-500">
          {profile?.status === "rejected"
            ? `Your previous request was rejected. ${profile.rejectionReason || ""}`
            : "Let guests reserve tables at your restaurant. Submit a request for admin approval to get started."}
        </p>
        <button
          onClick={handleRequest}
          disabled={requesting}
          className="mx-auto flex items-center gap-2 rounded-full bg-[#0D315B] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02] disabled:opacity-60"
        >
          {requesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Request Dining Access
        </button>
      </div>
    );
  }

  if (profile.status === "pending") {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center p-6 text-center">
        <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
          <Clock className="h-7 w-7" />
        </span>
        <h1 className="mb-2 text-xl font-bold text-gray-900">Request Pending</h1>
        <p className="text-sm text-gray-500">Your dining request is awaiting admin review. You&apos;ll be notified once it&apos;s approved.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4 pb-28 sm:p-6 sm:pb-24">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Dining Setup</h1>
          <p className="text-sm text-gray-500">Configure your dine-in experience and table availability</p>
        </div>
        <button
          onClick={handleToggleEnabled}
          disabled={toggling}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            profile.isDiningEnabled ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${profile.isDiningEnabled ? "bg-green-500" : "bg-gray-400"}`} />
          {toggling ? <Loader2 className="h-4 w-4 animate-spin" /> : (profile.isDiningEnabled ? "Live for guests" : "Disabled")}
        </button>
      </div>

      <div className="space-y-5">
        <SectionCard icon={FileText} title="About your dine-in experience" subtitle="Shown to guests browsing dine-in restaurants">
          <label className="mb-1.5 block text-xs font-semibold text-gray-600">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:border-[#0D315B] focus:outline-none focus:ring-1 focus:ring-[#0D315B]"
            placeholder="Tell guests about your dining ambience..."
          />

          <label className="mb-1.5 mt-4 block text-xs font-semibold text-gray-600">Average cost for two (₹)</label>
          <div className="relative w-full sm:w-56">
            <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="number"
              value={avgCostForTwo}
              onChange={(e) => setAvgCostForTwo(e.target.value)}
              className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-3 text-sm focus:border-[#0D315B] focus:outline-none focus:ring-1 focus:ring-[#0D315B]"
            />
          </div>
        </SectionCard>

        <SectionCard icon={ImagePlus} title="Ambience images" subtitle="Give guests a feel of the place before they book">
          <div className="flex flex-wrap gap-3">
            {ambienceImages.map((img, idx) => (
              <div key={img + idx} className="group relative h-24 w-24 overflow-hidden rounded-xl border border-gray-100">
                <img src={img} alt="" className="h-full w-full object-cover" />
                <button
                  onClick={() => setAmbienceImages((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 transition-colors hover:border-[#0D315B] hover:text-[#0D315B]">
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
              <span className="text-[10px] font-medium">Add photo</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
          </div>
        </SectionCard>

        {categories.length > 0 && (
          <SectionCard icon={Tag} title="Categories" subtitle="Pick tags that describe this dine-in venue">
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const active = categoryIds.includes(cat._id);
                return (
                  <button
                    key={cat._id}
                    onClick={() => toggleCategory(cat._id)}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active ? "border-[#0D315B] bg-[#0D315B]/5 text-[#0D315B]" : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {cat.image && <img src={cat.image} alt="" className="h-4 w-4 rounded-full object-cover" />}
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </SectionCard>
        )}

        <SectionCard icon={Clock} title="Weekly slots" subtitle="Set opening hours and table capacity per day">
          <div className="hidden grid-cols-[1fr_1fr_1fr_1fr_1fr] gap-2 px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 sm:grid">
            <span>Day</span>
            <span>Opens</span>
            <span>Closes</span>
            <span>Slot (min)</span>
            <span>Seats / slot</span>
          </div>
          <div className="space-y-2">
            {slots.map((slot, idx) => (
              <div
                key={slot.day}
                className={`grid grid-cols-2 items-center gap-2.5 rounded-xl border p-3 sm:grid-cols-5 ${
                  slot.isOpen ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50"
                }`}
              >
                <label className="col-span-2 flex items-center gap-2 text-sm font-semibold text-gray-700 sm:col-span-1">
                  <input
                    type="checkbox"
                    checked={slot.isOpen}
                    onChange={(e) => updateSlot(idx, "isOpen", e.target.checked)}
                    className="h-4 w-4 accent-[#0D315B]"
                  />
                  {DAY_LABELS[slot.day] || slot.day}
                </label>
                <div>
                  <span className="mb-0.5 block text-[10px] font-medium text-gray-400 sm:hidden">Opens</span>
                  <input
                    type="time"
                    value={slot.openingTime}
                    disabled={!slot.isOpen}
                    onChange={(e) => updateSlot(idx, "openingTime", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs disabled:opacity-40"
                  />
                </div>
                <div>
                  <span className="mb-0.5 block text-[10px] font-medium text-gray-400 sm:hidden">Closes</span>
                  <input
                    type="time"
                    value={slot.closingTime}
                    disabled={!slot.isOpen}
                    onChange={(e) => updateSlot(idx, "closingTime", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs disabled:opacity-40"
                  />
                </div>
                <div>
                  <span className="mb-0.5 block text-[10px] font-medium text-gray-400 sm:hidden">Slot duration (min)</span>
                  <input
                    type="number"
                    value={slot.slotDurationMinutes}
                    disabled={!slot.isOpen}
                    onChange={(e) => updateSlot(idx, "slotDurationMinutes", Number(e.target.value))}
                    placeholder="Duration"
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs disabled:opacity-40"
                  />
                </div>
                <div>
                  <span className="mb-0.5 block text-[10px] font-medium text-gray-400 sm:hidden">Seats per slot</span>
                  <input
                    type="number"
                    value={slot.capacityPerSlot}
                    disabled={!slot.isOpen}
                    onChange={(e) => updateSlot(idx, "capacityPerSlot", Number(e.target.value))}
                    placeholder="Seats"
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs disabled:opacity-40"
                  />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Sticky save bar so it's always reachable, especially on long slot lists */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 p-3 backdrop-blur-sm sm:sticky sm:mt-5 sm:rounded-xl sm:border sm:p-4 sm:shadow-sm">
        <button
          onClick={handleSaveSetup}
          disabled={saving}
          className="mx-auto flex w-full max-w-3xl items-center justify-center gap-2 rounded-xl bg-[#0D315B] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.01] disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Setup
        </button>
      </div>
    </div>
  );
}
