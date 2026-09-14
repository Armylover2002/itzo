import React, { useEffect, useMemo, useState } from 'react';
import { Edit, Loader2, Plus, Save, Settings, Trash2, Truck, IndianRupee, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@shared/components/ui/Toast';
import { adminApi } from '../services/adminApi';
import { useAuth } from "@core/context/AuthContext";
import { getCurrentUser } from "@food/utils/auth";
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions";
import Card from '@shared/components/ui/Card';

const initialFeeSettings = {
  deliveryFeeRanges: [],
  platformFee: 0,
  freeDeliveryThreshold: 0,
};

const toInputValue = (value) =>
  value === null || value === undefined || Number.isNaN(Number(value)) ? '' : String(value);

const toNullableNumber = (value) => {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export default function BillingCharges() {
  const { showToast } = useToast();
  const { user: authUser } = useAuth();
  const currentUser = useMemo(() => authUser || getCurrentUser("admin"), [authUser]);
  const [resolvedPermissions, setResolvedPermissions] = useState({});

  useEffect(() => {
    let isMounted = true;
    const resolvePermissions = async () => {
      if (!currentUser || currentUser.role === "ADMIN") {
        if (isMounted) setResolvedPermissions({});
        return;
      }
      const existingPermissions = extractAdminPermissions(currentUser);
      if (Object.keys(existingPermissions).length > 0) {
        if (isMounted) setResolvedPermissions(existingPermissions);
        return;
      }
      const roleId = extractAdminRoleId(currentUser);
      if (!roleId) {
        if (isMounted) setResolvedPermissions({});
        return;
      }
      try {
        const rolePermissions = await fetchAdminRolePermissions(roleId);
        if (isMounted) setResolvedPermissions(rolePermissions);
      } catch {
        if (isMounted) setResolvedPermissions({});
      }
    };
    resolvePermissions();
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const permissionKey = "quick::core_management::billing";
  const canCreate = canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "create");
  const canEdit = canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "edit");
  const canDelete = canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "delete");

  const [loading, setLoading] = useState(true);
  const [savingFeeSettings, setSavingFeeSettings] = useState(false);
  const [feeSettings, setFeeSettings] = useState(initialFeeSettings);
  
  const [editingRangeIndex, setEditingRangeIndex] = useState(null);
  const [newRange, setNewRange] = useState({ 
    min: '', 
    max: '', 
    fee: '0', 
    deliveryBoyPerKm: '0', 
    deliveryBoyBasePay: '0' 
  });

  useEffect(() => {
    loadFeeSettings();
  }, []);

  const loadFeeSettings = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getFeeSettings();
      const settings = response?.data?.data?.feeSettings || response?.data?.result?.feeSettings || response?.data?.result || null;
      if (!settings) {
        setFeeSettings(initialFeeSettings);
        return;
      }
      setFeeSettings({
        deliveryFeeRanges: Array.isArray(settings.deliveryFeeRanges) ? settings.deliveryFeeRanges : [],
        platformFee: Number(settings.platformFee || 0),
        freeDeliveryThreshold: Number(settings.freeDeliveryThreshold || 0),
      });
    } catch (error) {
      console.error('Failed to load quick fee settings', error);
      showToast('Failed to load fee settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (settingsToSave) => {
    try {
      setSavingFeeSettings(true);
      const payload = {
        deliveryFeeRanges: settingsToSave.deliveryFeeRanges.map(r => ({
          ...r,
          deliveryBoyPerKm: r.deliveryBoyPerKm === "" ? 0 : Number(r.deliveryBoyPerKm),
          deliveryBoyBasePay: r.deliveryBoyBasePay === "" ? 0 : Number(r.deliveryBoyBasePay),
        })),
        platformFee: Number(settingsToSave.platformFee || 0),
        freeDeliveryThreshold: Number(settingsToSave.freeDeliveryThreshold || 0),
        isActive: true,
      };
      
      const response = await adminApi.createOrUpdateFeeSettings(payload);
      const saved = response?.data?.data?.feeSettings;
      if (saved) {
        setFeeSettings({
          deliveryFeeRanges: Array.isArray(saved.deliveryFeeRanges) ? saved.deliveryFeeRanges : [],
          platformFee: Number(saved.platformFee || 0),
          freeDeliveryThreshold: Number(saved.freeDeliveryThreshold || 0),
        });
      }
      showToast('Quick fee settings saved successfully', 'success');
    } catch (error) {
      console.error('Failed to save quick fee settings', error);
      showToast(error?.response?.data?.message || 'Failed to save fee settings', 'error');
    } finally {
      setSavingFeeSettings(false);
    }
  };

  const handleSaveFeeSettings = async () => {
    await saveSettings(feeSettings);
  };

  const hasBasePayConfigured = (excludeIndex = null) => {
    return feeSettings.deliveryFeeRanges.some((range, idx) => 
      idx !== excludeIndex && Number(range.deliveryBoyBasePay) > 0
    );
  };

  const handleAddRange = async () => {
    const minRaw = String(newRange.min).trim();
    const maxRaw = String(newRange.max).trim();
    const feeRaw = String(newRange.fee).trim();

    if (minRaw === '' || maxRaw === '' || feeRaw === '') {
      showToast('Please fill all fields (Min, Max, Fee)', 'error');
      return;
    }

    const min = Number(minRaw);
    const max = Number(maxRaw);
    const fee = Number(feeRaw);
    const dbPerKm = Number(newRange.deliveryBoyPerKm || 0);
    const dbBasePay = Number(newRange.deliveryBoyBasePay || 0);

    if (isNaN(min) || isNaN(max) || isNaN(fee) || isNaN(dbPerKm) || isNaN(dbBasePay)) {
      showToast('Please enter valid numbers', 'error');
      return;
    }

    if (min < 0 || max < 0 || fee < 0 || dbPerKm < 0 || dbBasePay < 0) {
      showToast('All values must be positive numbers', 'error');
      return;
    }

    if (dbPerKm > 0 && dbBasePay > 0) {
      showToast('Please set either Per KM Amount or Base Pay, not both', 'error');
      return;
    }

    if (dbBasePay > 0 && hasBasePayConfigured()) {
      showToast('Base Pay can only be set for one range. It is already configured in another range.', 'error');
      return;
    }

    if (min >= max) {
      showToast('Min distance must be less than Max distance', 'error');
      return;
    }

    const otherRanges = editingRangeIndex !== null
      ? feeSettings.deliveryFeeRanges.filter((_, i) => i !== editingRangeIndex)
      : feeSettings.deliveryFeeRanges;

    for (const range of otherRanges) {
      if (
        (min >= range.min && min < range.max) ||
        (max > range.min && max <= range.max) ||
        (min <= range.min && max >= range.max)
      ) {
        showToast('This range overlaps with an existing range', 'error');
        return;
      }
    }

    const updatedRanges = [...feeSettings.deliveryFeeRanges, { 
      min, 
      max, 
      fee, 
      deliveryBoyPerKm: dbPerKm, 
      deliveryBoyBasePay: dbBasePay 
    }];
    updatedRanges.sort((a, b) => a.min - b.min);

    const updatedSettings = {
      ...feeSettings,
      deliveryFeeRanges: updatedRanges
    };

    setFeeSettings(updatedSettings);
    await saveSettings(updatedSettings);

    setNewRange({ min: '', max: '', fee: '0', deliveryBoyPerKm: '0', deliveryBoyBasePay: '0' });
  };

  const handleDeleteRange = async (index) => {
    const newRanges = feeSettings.deliveryFeeRanges.filter((_, i) => i !== index);
    const updatedSettings = {
      ...feeSettings,
      deliveryFeeRanges: newRanges
    };
    setFeeSettings(updatedSettings);
    await saveSettings(updatedSettings);
  };

  const handleEditRange = (index) => {
    const range = feeSettings.deliveryFeeRanges[index];
    setNewRange({ 
      min: range.min, 
      max: range.max, 
      fee: range.fee || '0',
      deliveryBoyPerKm: range.deliveryBoyPerKm ?? '0',
      deliveryBoyBasePay: range.deliveryBoyBasePay ?? '0'
    });
    setEditingRangeIndex(index);
  };

  const handleSaveEditRange = async () => {
    if (newRange.min === '' || newRange.max === '' || newRange.fee === '') {
      showToast('Please fill all fields', 'error');
      return;
    }

    const min = Number(newRange.min);
    const max = Number(newRange.max);
    const fee = Number(newRange.fee);
    const dbPerKm = Number(newRange.deliveryBoyPerKm || 0);
    const dbBasePay = Number(newRange.deliveryBoyBasePay || 0);

    if (min < 0 || max < 0 || fee < 0 || dbPerKm < 0 || dbBasePay < 0) {
      showToast('All values must be positive numbers', 'error');
      return;
    }

    if (dbPerKm > 0 && dbBasePay > 0) {
      showToast('Please set either Per KM Amount or Base Pay, not both', 'error');
      return;
    }

    if (dbBasePay > 0 && hasBasePayConfigured(editingRangeIndex)) {
      showToast('Base Pay can only be set for one range. It is already configured in another range.', 'error');
      return;
    }

    if (min >= max) {
      showToast('Min value must be less than Max value', 'error');
      return;
    }

    const ranges = [...feeSettings.deliveryFeeRanges];
    ranges.splice(editingRangeIndex, 1);

    for (const range of ranges) {
      if ((min >= range.min && min < range.max) || (max > range.min && max <= range.max) || (min <= range.min && max >= range.max)) {
        showToast('This range overlaps with an existing range', 'error');
        return;
      }
    }

    ranges.push({ 
      min, 
      max, 
      fee, 
      deliveryBoyPerKm: dbPerKm, 
      deliveryBoyBasePay: dbBasePay 
    });
    ranges.sort((a, b) => a.min - b.min);

    const updatedSettings = {
      ...feeSettings,
      deliveryFeeRanges: ranges
    };

    setFeeSettings(updatedSettings);
    await saveSettings(updatedSettings);

    setNewRange({ min: '', max: '', fee: '0', deliveryBoyPerKm: '0', deliveryBoyBasePay: '0' });
    setEditingRangeIndex(null);
  };

  const handleCancelEdit = () => {
    setNewRange({ min: '', max: '', fee: '0', deliveryBoyPerKm: '0', deliveryBoyBasePay: '0' });
    setEditingRangeIndex(null);
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="admin-h1">Quick Billing Settings</h1>
          <p className="admin-description mt-1">
            Configure platform fee and delivery fee slabs for Quick Commerce.
          </p>
        </div>
      </div>

      <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Settings className="h-5 w-5 text-primary" />
              Fee Settings
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Configure platform fee and free-delivery threshold.
            </p>
          </div>
          <button
            onClick={handleSaveFeeSettings}
            disabled={loading || savingFeeSettings}
            className={cn(
              'inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white',
              savingFeeSettings ? 'bg-primary/90' : 'bg-primary hover:bg-primary/90',
            )}
          >
            {savingFeeSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Settings
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          </div>
        ) : (
          <div className="space-y-8 p-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Platform Fee</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Flat fee added to every Quick Commerce order total.
                </p>
              </div>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Amount (₹)</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={toInputValue(feeSettings.platformFee)}
                  onChange={(e) =>
                    setFeeSettings((prev) => ({
                      ...prev,
                      platformFee: toNullableNumber(e.target.value) ?? 0,
                    }))
                  }
                  className="w-full max-w-xs rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Free delivery above (₹)</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={toInputValue(feeSettings.freeDeliveryThreshold)}
                  onChange={(e) =>
                    setFeeSettings((prev) => ({
                      ...prev,
                      freeDeliveryThreshold: toNullableNumber(e.target.value) ?? 0,
                    }))
                  }
                  className="w-full max-w-xs rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-xs text-slate-500">
                  Set 0 to disable. When cart subtotal reaches this amount, delivery fee is waived.
                </p>
              </label>
            </div>
          </div>
        )}
      </Card>

      <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Truck className="h-5 w-5 text-sky-600" />
            Distance-Based Delivery Fee Slabs
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Define delivery fee slabs based on the delivery distance. The user will be charged the exact fee configured for their distance slab, and the delivery boy will be paid according to the DB amounts.
          </p>
        </div>

        <div className="space-y-6 p-6">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              {editingRangeIndex !== null ? (
                <Edit className="w-4 h-4 text-blue-600" />
              ) : (
                <Plus className="w-4 h-4 text-primary" />
              )}
              <h4 className="text-sm font-semibold text-slate-700">
                {editingRangeIndex !== null ? 'Edit Range' : 'Add New Range'}
              </h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Min Distance (km)</label>
                <input
                  type="number"
                  value={newRange.min}
                  onChange={(e) => setNewRange({ ...newRange, min: e.target.value })}
                  min="0"
                  step="0.1"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none transition-all"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Max Distance (km)</label>
                <input
                  type="number"
                  value={newRange.max}
                  onChange={(e) => setNewRange({ ...newRange, max: e.target.value })}
                  min="0"
                  step="0.1"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none transition-all"
                  placeholder="5"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">User Delivery Fee (₹)</label>
                <input
                  type="number"
                  value={newRange.fee}
                  onChange={(e) => setNewRange({ ...newRange, fee: e.target.value })}
                  min="0"
                  step="1"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none transition-all text-green-600 font-medium"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">DB Per KM (₹)</label>
                <input
                  type="number"
                  value={newRange.deliveryBoyPerKm}
                  disabled={Number(newRange.deliveryBoyBasePay) > 0}
                  onChange={(e) => setNewRange({ ...newRange, deliveryBoyPerKm: e.target.value, deliveryBoyBasePay: '0' })}
                  min="0"
                  step="1"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none transition-all disabled:bg-slate-100 disabled:cursor-not-allowed"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">DB Base Pay (₹)</label>
                <input
                  type="number"
                  value={newRange.deliveryBoyBasePay}
                  disabled={Number(newRange.deliveryBoyPerKm) > 0 || (hasBasePayConfigured(editingRangeIndex))}
                  onChange={(e) => setNewRange({ ...newRange, deliveryBoyBasePay: e.target.value, deliveryBoyPerKm: '0' })}
                  min="0"
                  step="1"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none transition-all disabled:bg-slate-100 disabled:cursor-not-allowed"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              {editingRangeIndex !== null ? (
                <>
                  <button
                    onClick={handleCancelEdit}
                    className="border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors bg-white shadow-xs"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                  {canEdit && (
                    <button
                      onClick={handleSaveEditRange}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                    >
                      <Check className="w-4 h-4" />
                      Update Range
                    </button>
                  )}
                </>
              ) : (
                canCreate && (
                  <button
                    onClick={handleAddRange}
                    className="bg-primary hover:bg-primary/90 text-white px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add Range
                  </button>
                )
              )}
            </div>
          </div>

          {feeSettings.deliveryFeeRanges.length > 0 ? (
            <div className="overflow-x-auto mt-6">
              <table className="w-full border border-slate-200 rounded-lg">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 border-b border-slate-200">Min Distance (km)</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 border-b border-slate-200">Max Distance (km)</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 border-b border-slate-200">User Delivery Fee (₹)</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 border-b border-slate-200">DB Per KM (₹)</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 border-b border-slate-200">DB Base Pay (₹)</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 border-b border-slate-200">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {feeSettings.deliveryFeeRanges
                    .map((range, originalIndex) => ({ range, originalIndex }))
                    .sort((a, b) => a.range.min - b.range.min)
                    .map(({ range, originalIndex }) => {
                      const isEditing = editingRangeIndex === originalIndex;
                      return (
                        <tr key={originalIndex} className={cn(isEditing ? 'bg-blue-50/50' : 'hover:bg-slate-50/80', "transition-colors")}>
                          <td className="px-4 py-3 text-sm border-b border-slate-100">{range.min} km</td>
                          <td className="px-4 py-3 text-sm border-b border-slate-100">{range.max} km</td>
                          <td className="px-4 py-3 text-sm border-b border-slate-100 font-semibold text-emerald-700">₹{range.fee}</td>
                          <td className="px-4 py-3 text-sm border-b border-slate-100">
                            {range.deliveryBoyPerKm ? `₹${range.deliveryBoyPerKm}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm border-b border-slate-100">
                            {range.deliveryBoyBasePay ? `₹${range.deliveryBoyBasePay}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-center border-b border-slate-100">
                            <div className="flex items-center justify-center gap-2">
                              {canEdit && (
                                <button
                                  onClick={() => handleEditRange(originalIndex)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => handleDeleteRange(originalIndex)}
                                  className="p-1.5 text-slate-900 hover:bg-red-50 rounded transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 border border-dashed border-slate-300 rounded-xl bg-slate-50 text-slate-500">
              No delivery fee slabs configured. Add one above.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
