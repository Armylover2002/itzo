import React, { useEffect, useMemo, useState } from 'react';
import { Edit, Loader2, Plus, Save, Settings, Trash2, Truck } from 'lucide-react';
import Card from '@shared/components/ui/Card';
import { cn } from '@/lib/utils';
import { useToast } from '@shared/components/ui/Toast';
import { adminApi } from '../services/adminApi';

const initialFeeSettings = {
  deliveryFee: '',
  deliveryFeeRanges: [],
  freeDeliveryThreshold: '',
  platformFee: '',
  gstRate: '',
  returnDeliveryCommission: '',
};

const initialRuleForm = {
  name: '',
  minDistance: '0',
  maxDistance: '',
  maxDistanceUnlimited: false,
  commissionPerKm: '',
  basePayout: '',
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
  const [loading, setLoading] = useState(true);
  const [savingFeeSettings, setSavingFeeSettings] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [feeSettings, setFeeSettings] = useState(initialFeeSettings);
  const [newRange, setNewRange] = useState({ min: '', max: '', fee: '' });
  const [editingRangeIndex, setEditingRangeIndex] = useState(null);
  const [rules, setRules] = useState([]);
  const [editingRuleId, setEditingRuleId] = useState('');
  const [ruleForm, setRuleForm] = useState(initialRuleForm);

  const sortedRules = useMemo(
    () =>
      [...rules].sort(
        (a, b) => Number(a.minDistance || 0) - Number(b.minDistance || 0),
      ),
    [rules],
  );

  useEffect(() => {
    void Promise.all([loadFeeSettings(), loadRules()]);
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
        deliveryFee: toInputValue(settings.deliveryFee),
        deliveryFeeRanges: Array.isArray(settings.deliveryFeeRanges) ? settings.deliveryFeeRanges : [],
        freeDeliveryThreshold: toInputValue(settings.freeDeliveryThreshold),
        platformFee: toInputValue(settings.platformFee),
        gstRate: toInputValue(settings.gstRate),
        returnDeliveryCommission: toInputValue(settings.returnDeliveryCommission),
      });
    } catch (error) {
      console.error('Failed to load quick fee settings', error);
      showToast('Failed to load fee settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadRules = async () => {
    try {
      setRulesLoading(true);
      const response = await adminApi.getDeliveryCommissionRules();
      const list =
        response?.data?.data?.commissions ||
        response?.data?.commissions ||
        [];
      setRules(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Failed to load quick delivery commission rules', error);
      showToast('Failed to load delivery commission rules', 'error');
    } finally {
      setRulesLoading(false);
    }
  };

  const handleSaveFeeSettings = async () => {
    try {
      setSavingFeeSettings(true);
      const payload = {
        deliveryFee: toNullableNumber(feeSettings.deliveryFee),
        deliveryFeeRanges: feeSettings.deliveryFeeRanges,
        freeDeliveryThreshold: toNullableNumber(feeSettings.freeDeliveryThreshold),
        platformFee: toNullableNumber(feeSettings.platformFee),
        gstRate: toNullableNumber(feeSettings.gstRate),
        returnDeliveryCommission: toNullableNumber(feeSettings.returnDeliveryCommission) ?? 0,
        isActive: true,
      };
      const response = await adminApi.createOrUpdateFeeSettings(payload);
      const saved = response?.data?.data?.feeSettings;
      if (saved) {
        setFeeSettings({
          deliveryFee: toInputValue(saved.deliveryFee),
          deliveryFeeRanges: Array.isArray(saved.deliveryFeeRanges) ? saved.deliveryFeeRanges : [],
          freeDeliveryThreshold: toInputValue(saved.freeDeliveryThreshold),
          platformFee: toInputValue(saved.platformFee),
          gstRate: toInputValue(saved.gstRate),
          returnDeliveryCommission: toInputValue(saved.returnDeliveryCommission),
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

  const resetRuleForm = () => {
    setEditingRuleId('');
    setRuleForm(initialRuleForm);
  };

  const handleAddOrUpdateRange = () => {
    const min = Number(newRange.min);
    const max = Number(newRange.max);
    const fee = Number(newRange.fee);

    if (![min, max, fee].every(Number.isFinite)) {
      showToast('Please fill all range fields', 'error');
      return;
    }
    if (min < 0 || max < 0 || fee < 0) {
      showToast('Values must be 0 or greater', 'error');
      return;
    }
    if (min >= max) {
      showToast('Min value must be less than max value', 'error');
      return;
    }

    const nextRanges = [...feeSettings.deliveryFeeRanges];
    if (editingRangeIndex !== null) {
      nextRanges.splice(editingRangeIndex, 1);
    }

    for (const range of nextRanges) {
      if (
        (min >= Number(range.min) && min < Number(range.max)) ||
        (max > Number(range.min) && max <= Number(range.max)) ||
        (min <= Number(range.min) && max >= Number(range.max))
      ) {
        showToast('This range overlaps with an existing range', 'error');
        return;
      }
    }

    nextRanges.push({ min, max, fee });
    nextRanges.sort((a, b) => Number(a.min) - Number(b.min));
    setFeeSettings((prev) => ({ ...prev, deliveryFeeRanges: nextRanges }));
    setNewRange({ min: '', max: '', fee: '' });
    setEditingRangeIndex(null);
  };

  const handleEditRange = (index) => {
    const range = feeSettings.deliveryFeeRanges[index];
    setNewRange({
      min: toInputValue(range?.min),
      max: toInputValue(range?.max),
      fee: toInputValue(range?.fee),
    });
    setEditingRangeIndex(index);
  };

  const handleDeleteRange = (index) => {
    setFeeSettings((prev) => ({
      ...prev,
      deliveryFeeRanges: prev.deliveryFeeRanges.filter((_, idx) => idx !== index),
    }));
    if (editingRangeIndex === index) {
      setNewRange({ min: '', max: '', fee: '' });
      setEditingRangeIndex(null);
    }
  };

  const handleEditRule = (rule) => {
    const isUnlimited = rule.maxDistance === null || rule.maxDistance === undefined;
    setEditingRuleId(rule._id);
    setRuleForm({
      name: rule.name || '',
      minDistance: toInputValue(rule.minDistance),
      maxDistance: isUnlimited ? '' : toInputValue(rule.maxDistance),
      maxDistanceUnlimited: isUnlimited,
      commissionPerKm: toInputValue(rule.commissionPerKm),
      basePayout: toInputValue(rule.basePayout),
    });
  };

  const handleSaveRule = async () => {
    const minDistance = Number(ruleForm.minDistance);
    const maxDistance =
      ruleForm.maxDistanceUnlimited || ruleForm.maxDistance === ''
        ? null
        : Number(ruleForm.maxDistance);
    const commissionPerKm = Number(ruleForm.commissionPerKm);
    const basePayout = Number(ruleForm.basePayout);

    if (![minDistance, commissionPerKm, basePayout].every(Number.isFinite)) {
      showToast('Please fill all required commission rule fields', 'error');
      return;
    }

    try {
      setSavingRule(true);
      const payload = {
        name: ruleForm.name.trim() || `Base (${minDistance}${maxDistance === null ? '+' : `-${maxDistance}`} km)`,
        minDistance,
        maxDistance,
        commissionPerKm,
        basePayout,
        status: true,
      };

      if (editingRuleId) {
        await adminApi.updateDeliveryCommissionRule(editingRuleId, payload);
        showToast('Commission rule updated successfully', 'success');
      } else {
        await adminApi.createDeliveryCommissionRule(payload);
        showToast('Commission rule created successfully', 'success');
      }

      resetRuleForm();
      await loadRules();
    } catch (error) {
      console.error('Failed to save quick delivery commission rule', error);
      showToast(error?.response?.data?.message || 'Failed to save commission rule', 'error');
    } finally {
      setSavingRule(false);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    try {
      await adminApi.deleteDeliveryCommissionRule(ruleId);
      setRules((prev) => prev.filter((rule) => rule._id !== ruleId));
      if (editingRuleId === ruleId) resetRuleForm();
      showToast('Commission rule deleted successfully', 'success');
    } catch (error) {
      console.error('Failed to delete quick delivery commission rule', error);
      showToast(error?.response?.data?.message || 'Failed to delete commission rule', 'error');
    }
  };

  const handleToggleRuleStatus = async (rule) => {
    try {
      await adminApi.toggleDeliveryCommissionRuleStatus(rule._id, !rule.status);
      setRules((prev) =>
        prev.map((item) =>
          item._id === rule._id ? { ...item, status: !rule.status } : item,
        ),
      );
      showToast('Commission rule status updated', 'success');
    } catch (error) {
      console.error('Failed to toggle quick delivery commission rule', error);
      showToast(error?.response?.data?.message || 'Failed to update status', 'error');
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="admin-h1">Quick Billing Settings</h1>
          <p className="admin-description mt-1">
            Quick Commerce controls similar to Food admin fee settings and delivery commission slabs.
          </p>
        </div>
      </div>

      <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Settings className="h-5 w-5 text-emerald-600" />
              Fee Settings
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Set delivery fee, platform fee, GST, and return commission based on order value.
            </p>
          </div>
          <button
            onClick={handleSaveFeeSettings}
            disabled={loading || savingFeeSettings}
            className={cn(
              'inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white',
              savingFeeSettings ? 'bg-emerald-400' : 'bg-emerald-600 hover:bg-emerald-700',
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
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
              {[
                ['deliveryFee', 'Default Delivery Fee'],
                ['freeDeliveryThreshold', 'Free Delivery Threshold'],
                ['platformFee', 'Platform Fee'],
                ['gstRate', 'GST Rate (%)'],
              ].map(([field, label]) => (
                <label key={field} className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">{label}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={feeSettings[field]}
                    onChange={(e) =>
                      setFeeSettings((prev) => ({ ...prev, [field]: e.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                  />
                </label>
              ))}
            </div>

            <label className="block max-w-sm space-y-2">
              <span className="text-sm font-semibold text-slate-700">Return Delivery Commission</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={feeSettings.returnDeliveryCommission}
                onChange={(e) =>
                  setFeeSettings((prev) => ({
                    ...prev,
                    returnDeliveryCommission: e.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
              />
            </label>

            <div className="rounded-3xl border border-slate-200 p-5">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900">Delivery Fee Ranges</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Set delivery fee based on order value ranges, similar to food fee settings.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newRange.min}
                  onChange={(e) => setNewRange((prev) => ({ ...prev, min: e.target.value }))}
                  placeholder="Min order"
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newRange.max}
                  onChange={(e) => setNewRange((prev) => ({ ...prev, max: e.target.value }))}
                  placeholder="Max order"
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newRange.fee}
                  onChange={(e) => setNewRange((prev) => ({ ...prev, fee: e.target.value }))}
                  placeholder="Delivery fee"
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleAddOrUpdateRange}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4" />
                  {editingRangeIndex !== null ? 'Update Range' : 'Add Range'}
                </button>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-slate-500">
                      <th className="px-3 py-3 font-semibold">Min</th>
                      <th className="px-3 py-3 font-semibold">Max</th>
                      <th className="px-3 py-3 font-semibold">Fee</th>
                      <th className="px-3 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feeSettings.deliveryFeeRanges.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="px-3 py-8 text-center text-slate-400">
                          No delivery fee ranges configured.
                        </td>
                      </tr>
                    ) : (
                      feeSettings.deliveryFeeRanges.map((range, index) => (
                        <tr key={`${range.min}-${range.max}-${index}`} className="border-b border-slate-50">
                          <td className="px-3 py-3">Rs {range.min}</td>
                          <td className="px-3 py-3">Rs {range.max}</td>
                          <td className="px-3 py-3 font-semibold text-emerald-700">Rs {range.fee}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEditRange(index)}
                                className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteRange(index)}
                                className="rounded-xl border border-rose-200 p-2 text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Truck className="h-5 w-5 text-primary" />
            Delivery Boy Commission Rules
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Slab setup similar to <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">/ecs/food/delivery-boy-commission</code>, but isolated for Quick Commerce.
          </p>
        </div>

        <div className="space-y-6 p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <input
              type="text"
              value={ruleForm.name}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Rule name"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary xl:col-span-2"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={ruleForm.minDistance}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, minDistance: e.target.value }))}
              placeholder="Min km"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={ruleForm.maxDistance}
              disabled={ruleForm.maxDistanceUnlimited}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, maxDistance: e.target.value }))}
              placeholder="Max km"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary disabled:bg-slate-50"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={ruleForm.commissionPerKm}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, commissionPerKm: e.target.value }))}
              placeholder="Commission/km"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={ruleForm.basePayout}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, basePayout: e.target.value }))}
              placeholder="Base payout"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={ruleForm.maxDistanceUnlimited}
              onChange={(e) =>
                setRuleForm((prev) => ({
                  ...prev,
                  maxDistanceUnlimited: e.target.checked,
                  maxDistance: e.target.checked ? '' : prev.maxDistance,
                }))
              }
            />
            Max distance unlimited
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSaveRule}
              disabled={savingRule}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary-hover"
            >
              {savingRule ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingRuleId ? 'Update Rule' : 'Add Rule'}
            </button>
            {editingRuleId ? (
              <button
                onClick={resetRuleForm}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel Edit
              </button>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="px-3 py-3 font-semibold">Rule</th>
                  <th className="px-3 py-3 font-semibold">Distance slab</th>
                  <th className="px-3 py-3 font-semibold">Commission/km</th>
                  <th className="px-3 py-3 font-semibold">Base payout</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rulesLoading ? (
                  <tr>
                    <td colSpan="6" className="px-3 py-8 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
                    </td>
                  </tr>
                ) : sortedRules.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-3 py-8 text-center text-slate-400">
                      No delivery commission rules configured.
                    </td>
                  </tr>
                ) : (
                  sortedRules.map((rule) => (
                    <tr key={rule._id} className="border-b border-slate-50">
                      <td className="px-3 py-3 font-medium text-slate-900">{rule.name || '-'}</td>
                      <td className="px-3 py-3">
                        {rule.maxDistance === null || rule.maxDistance === undefined
                          ? `${rule.minDistance}+ km`
                          : `${rule.minDistance}-${rule.maxDistance} km`}
                      </td>
                      <td className="px-3 py-3 font-semibold text-orange-700">Rs {rule.commissionPerKm}</td>
                      <td className="px-3 py-3 font-semibold text-emerald-700">Rs {rule.basePayout}</td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => handleToggleRuleStatus(rule)}
                          className={cn(
                            'inline-flex rounded-full px-3 py-1 text-xs font-bold',
                            rule.status
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-500',
                          )}
                        >
                          {rule.status ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditRule(rule)}
                            className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule._id)}
                            className="rounded-xl border border-rose-200 p-2 text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
