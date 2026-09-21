import { useEffect, useState } from "react";
import { Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { adminAPI } from "@food/api";
import { useAdminPermissions } from "@food/hooks/admin/useAdminPermissions";

const PERMISSION_KEY = "food::dining_management::dining_restaurants";

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

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-xl font-bold text-gray-900 sm:text-2xl">Dining Restaurants</h1>
      <p className="mb-6 text-sm text-gray-500">Approved restaurants with dine-in enabled and their commission settings</p>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : restaurants.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center text-gray-500">No approved dining restaurants yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Restaurant</th>
                <th className="px-4 py-3">Enabled</th>
                <th className="px-4 py-3">Commission</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {restaurants.map((profile) => (
                <tr key={profile._id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{profile.restaurant?.name || "—"}</div>
                    <div className="text-xs text-gray-500">{profile.restaurant?.phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${profile.isDiningEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {profile.isDiningEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {editingId === profile._id ? (
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-xs">
                          <input type="checkbox" checked={form.override} onChange={(e) => setForm((p) => ({ ...p, override: e.target.checked }))} />
                          Override
                        </label>
                        <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} className="rounded border border-gray-300 px-1.5 py-1 text-xs">
                          <option value="percentage">%</option>
                          <option value="amount">₹</option>
                        </select>
                        <input type="number" value={form.value} onChange={(e) => setForm((p) => ({ ...p, value: Number(e.target.value) }))} className="w-16 rounded border border-gray-300 px-1.5 py-1 text-xs" />
                      </div>
                    ) : (
                      <span className="text-xs text-gray-600">
                        {profile.commission?.override
                          ? `Override: ${profile.commission.value}${profile.commission.type === "percentage" ? "%" : "₹"}`
                          : "Default"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canEdit && (
                      editingId === profile._id ? (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setEditingId(null)} className="text-xs text-gray-500">Cancel</button>
                          <button onClick={() => handleSave(profile._id)} disabled={saving} className="rounded-lg bg-[#6412C6] px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">
                            Save
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => openEdit(profile)} className="text-gray-500 hover:text-gray-900">
                          <Settings2 className="h-4 w-4" />
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
