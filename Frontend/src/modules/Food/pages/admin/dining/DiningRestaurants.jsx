import { useEffect, useState } from "react";
import { Loader2, Settings2, IndianRupee, Phone, MapPin, ImageIcon, X, Check } from "lucide-react";
import { toast } from "sonner";
import { adminAPI } from "@food/api";
import { useAdminPermissions } from "@food/hooks/admin/useAdminPermissions";

const PERMISSION_KEY = "food::dining_management::dining_restaurants";

function RestaurantCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="h-32 w-full animate-pulse bg-gray-100" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-gray-100" />
      </div>
    </div>
  );
}

export default function DiningRestaurants() {
  const { canEdit } = useAdminPermissions(PERMISSION_KEY);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ override: false, type: "percentage", value: 0 });
  const [saving, setSaving] = useState(false);

  const fetchRestaurants = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getDiningRestaurants({ status: "approved" });
      setRestaurants(res?.data?.data?.restaurants || []);
    } catch {
      toast.error("Failed to load dining restaurants");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRestaurants(); }, []);

  const openEdit = (profile) => {
    setEditingId(profile._id);
    setForm({
      override: !!profile.commission?.override,
      type: profile.commission?.type || "percentage",
      value: profile.commission?.value || 0,
    });
  };

  const handleSave = async (id) => {
    try {
      setSaving(true);
      await adminAPI.setDiningCommissionOverride(id, form);
      toast.success("Commission updated");
      setEditingId(null);
      fetchRestaurants();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update commission");
    } finally {
      setSaving(false);
    }
  };

  const getRestaurantImage = (restaurant) =>
    restaurant?.profileImage || restaurant?.image || (Array.isArray(restaurant?.images) ? restaurant.images[0] : null);

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-xl font-bold text-gray-900 sm:text-2xl">Dining Restaurants</h1>
      <p className="mb-6 text-sm text-gray-500">Approved restaurants with dine-in enabled and their commission settings</p>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <RestaurantCardSkeleton key={i} />)}
        </div>
      ) : restaurants.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-300 py-16 text-center text-gray-500">
          <ImageIcon className="h-6 w-6 text-gray-300" />
          No approved dining restaurants yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.map((profile) => {
            const restaurant = profile.restaurant;
            const image = getRestaurantImage(restaurant);
            const isEditing = editingId === profile._id;

            return (
              <div key={profile._id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                {/* Restaurant image */}
                <div className="relative h-32 w-full bg-gray-100">
                  {image ? (
                    <img src={image} alt={restaurant?.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-300">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                  )}
                  <span
                    className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm ${
                      profile.isDiningEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {profile.isDiningEnabled ? "Enabled" : "Disabled"}
                  </span>
                </div>

                {/* Details */}
                <div className="p-4">
                  <div className="mb-2 font-semibold text-gray-900">{restaurant?.name || "—"}</div>

                  <div className="mb-3 space-y-1 text-xs text-gray-500">
                    {restaurant?.ownerPhone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 shrink-0" /> {restaurant.ownerPhone}
                      </div>
                    )}
                    {(restaurant?.area || restaurant?.city) && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="line-clamp-1">{[restaurant.area, restaurant.city].filter(Boolean).join(", ")}</span>
                      </div>
                    )}
                    {profile.avgCostForTwo > 0 && (
                      <div className="flex items-center gap-1.5">
                        <IndianRupee className="h-3 w-3 shrink-0" /> {profile.avgCostForTwo} for two
                      </div>
                    )}
                  </div>

                  {/* Commission */}
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-2.5">
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Commission</div>
                    {isEditing ? (
                      <div className="space-y-2">
                        <label className="flex items-center gap-1.5 text-xs text-gray-700">
                          <input type="checkbox" checked={form.override} onChange={(e) => setForm((p) => ({ ...p, override: e.target.checked }))} />
                          Override default
                        </label>
                        <div className="flex items-center gap-2">
                          <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} className="rounded border border-gray-300 px-1.5 py-1 text-xs">
                            <option value="percentage">%</option>
                            <option value="amount">₹</option>
                          </select>
                          <input type="number" value={form.value} onChange={(e) => setForm((p) => ({ ...p, value: Number(e.target.value) }))} className="w-20 rounded border border-gray-300 px-1.5 py-1 text-xs" />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button onClick={() => setEditingId(null)} className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600">
                            <X className="h-3 w-3" /> Cancel
                          </button>
                          <button onClick={() => handleSave(profile._id)} disabled={saving} className="flex items-center gap-1 rounded-lg bg-[#6412C6] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60">
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700">
                          {profile.commission?.override
                            ? `Override: ${profile.commission.value}${profile.commission.type === "percentage" ? "%" : "₹"}`
                            : "Default"}
                        </span>
                        {canEdit && (
                          <button onClick={() => openEdit(profile)} className="flex items-center gap-1 rounded-full border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-white">
                            <Settings2 className="h-3 w-3" /> Edit
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
