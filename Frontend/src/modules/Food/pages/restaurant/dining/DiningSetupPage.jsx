import { useEffect, useState } from "react";
import { Loader2, Save, Send, Plus, X, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { restaurantAPI, diningAPI, uploadAPI } from "@food/api";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function defaultSlots() {
  return DAY_NAMES.map((day) => ({
    day, isOpen: false, openingTime: "12:00", closingTime: "22:00", slotDurationMinutes: 60, capacityPerSlot: 0,
  }));
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

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;

  if (!profile || profile.status === "not_requested" || profile.status === "rejected") {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <h1 className="mb-2 text-xl font-bold text-gray-900">Enable Dine-In Bookings</h1>
        <p className="mb-6 text-sm text-gray-500">
          {profile?.status === "rejected"
            ? `Your previous request was rejected. ${profile.rejectionReason || ""}`
            : "Let guests reserve tables at your restaurant. Submit a request for admin approval to get started."}
        </p>
        <button
          onClick={handleRequest}
          disabled={requesting}
          className="mx-auto flex items-center gap-2 rounded-lg bg-[#0D315B] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {requesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Request Dining Access
        </button>
      </div>
    );
  }

  if (profile.status === "pending") {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <h1 className="mb-2 text-xl font-bold text-gray-900">Request Pending</h1>
        <p className="text-sm text-gray-500">Your dining request is awaiting admin review. You'll be notified once it's approved.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Dining Setup</h1>
          <p className="text-sm text-gray-500">Configure your dine-in experience and table availability</p>
        </div>
        <button
          onClick={handleToggleEnabled}
          disabled={toggling}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${profile.isDiningEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
        >
          {toggling ? <Loader2 className="h-4 w-4 animate-spin" /> : (profile.isDiningEnabled ? "Enabled" : "Disabled")}
        </button>
      </div>

      <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-800">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Tell guests about your dining ambience..." />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-800">Average cost for two (₹)</label>
          <input type="number" value={avgCostForTwo} onChange={(e) => setAvgCostForTwo(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm sm:w-48" />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-800">Ambience images</label>
          <div className="flex flex-wrap gap-2">
            {ambienceImages.map((img, idx) => (
              <div key={img + idx} className="relative h-20 w-20">
                <img src={img} alt="" className="h-full w-full rounded-lg object-cover" />
                <button onClick={() => setAmbienceImages((prev) => prev.filter((_, i) => i !== idx))} className="absolute -right-1 -top-1 rounded-full bg-black/70 p-0.5 text-white">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-gray-400">
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
          </div>
        </div>

        {categories.length > 0 && (
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-800">Categories</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat._id}
                  onClick={() => toggleCategory(cat._id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${categoryIds.includes(cat._id) ? "border-[#0D315B] bg-red-50 text-[#0D315B]" : "border-gray-200 text-gray-600"}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-800">Weekly slots</label>
          <div className="space-y-2">
            {slots.map((slot, idx) => (
              <div key={slot.day} className="grid grid-cols-2 items-center gap-2 rounded-lg border border-gray-100 p-2 sm:grid-cols-6">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input type="checkbox" checked={slot.isOpen} onChange={(e) => updateSlot(idx, "isOpen", e.target.checked)} />
                  {slot.day}
                </label>
                <input type="time" value={slot.openingTime} disabled={!slot.isOpen} onChange={(e) => updateSlot(idx, "openingTime", e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40" />
                <input type="time" value={slot.closingTime} disabled={!slot.isOpen} onChange={(e) => updateSlot(idx, "closingTime", e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40" />
                <input type="number" value={slot.slotDurationMinutes} disabled={!slot.isOpen} onChange={(e) => updateSlot(idx, "slotDurationMinutes", Number(e.target.value))} placeholder="Duration (min)" className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40" />
                <input type="number" value={slot.capacityPerSlot} disabled={!slot.isOpen} onChange={(e) => updateSlot(idx, "capacityPerSlot", Number(e.target.value))} placeholder="Seats/slot" className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40" />
              </div>
            ))}
          </div>
        </div>

        <button onClick={handleSaveSetup} disabled={saving} className="flex items-center gap-2 rounded-lg bg-[#0D315B] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Setup
        </button>
      </div>
    </div>
  );
}
