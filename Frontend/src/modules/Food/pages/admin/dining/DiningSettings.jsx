import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { adminAPI } from "@food/api";
import { useAdminPermissions } from "@food/hooks/admin/useAdminPermissions";

const PERMISSION_KEY = "food::dining_management::dining_settings";

export default function DiningSettings() {
  const { canEdit } = useAdminPermissions(PERMISSION_KEY);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminAPI.getDiningSettings();
        setSettings(res?.data?.data?.settings || null);
      } catch {
        toast.error("Failed to load dining settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = (field, value) => setSettings((prev) => ({ ...prev, [field]: value }));
  const updateCommission = (field, value) =>
    setSettings((prev) => ({ ...prev, defaultCommission: { ...prev.defaultCommission, [field]: value } }));

  const handleSave = async () => {
    try {
      setSaving(true);
      await adminAPI.updateDiningSettings({
        defaultCommission: settings.defaultCommission,
        minAdvanceBookingMinutes: Number(settings.minAdvanceBookingMinutes),
        maxAdvanceBookingDays: Number(settings.maxAdvanceBookingDays),
        cancellationWindowMinutes: Number(settings.cancellationWindowMinutes),
        taxPercent: Number(settings.taxPercent),
      });
      toast.success("Dining settings updated");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  if (!settings) return null;

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="mb-1 text-xl font-bold text-gray-900 sm:text-2xl">Dining Settings</h1>
      <p className="mb-6 text-sm text-gray-500">Global defaults applied across all dining-enabled restaurants</p>

      <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-800">Default commission</label>
          <div className="flex gap-2">
            <select
              value={settings.defaultCommission?.type}
              onChange={(e) => updateCommission("type", e.target.value)}
              disabled={!canEdit}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="percentage">Percentage</option>
              <option value="amount">Fixed amount</option>
            </select>
            <input
              type="number"
              value={settings.defaultCommission?.value}
              onChange={(e) => updateCommission("value", Number(e.target.value))}
              disabled={!canEdit}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-800">Minimum advance booking (minutes)</label>
          <input type="number" value={settings.minAdvanceBookingMinutes} disabled={!canEdit} onChange={(e) => update("minAdvanceBookingMinutes", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-800">Maximum advance booking (days)</label>
          <input type="number" value={settings.maxAdvanceBookingDays} disabled={!canEdit} onChange={(e) => update("maxAdvanceBookingDays", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-800">Cancellation window (minutes)</label>
          <input type="number" value={settings.cancellationWindowMinutes} disabled={!canEdit} onChange={(e) => update("cancellationWindowMinutes", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-800">Tax percent</label>
          <input type="number" value={settings.taxPercent} disabled={!canEdit} onChange={(e) => update("taxPercent", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>

        {canEdit && (
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-lg bg-[#6412C6] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Settings
          </button>
        )}
      </div>
    </div>
  );
}
