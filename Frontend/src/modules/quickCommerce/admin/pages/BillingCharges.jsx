import React, { useEffect, useState } from 'react';
import { Check, Edit, Loader2, Plus, Save, Settings, Trash2, Truck, X } from 'lucide-react';
import Card from '@shared/components/ui/Card';
import { cn } from '@/lib/utils';
import { useToast } from '@shared/components/ui/Toast';
import { adminApi } from '../services/adminApi';

const initialFeeSettings = {
  baseDistanceKm: '',
  baseDeliveryFee: '',
  perKmCharge: '',
  sponsorRules: [],
  platformFee: '',
  gstRate: '',
};

const EMPTY_SPONSOR_RULE = {
  minOrderAmount: '',
  maxOrderAmount: '',
  maxDistanceKm: '',
  sponsorType: 'USER_FULL',
  sponsoredKm: '',
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
  const [feeSettings, setFeeSettings] = useState(initialFeeSettings);
  const [editingSponsorRuleIndex, setEditingSponsorRuleIndex] = useState(null);
  const [sponsorRuleDraft, setSponsorRuleDraft] = useState(EMPTY_SPONSOR_RULE);

  useEffect(() => {
    void loadFeeSettings();
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
        baseDistanceKm: toInputValue(settings.baseDistanceKm),
        baseDeliveryFee: toInputValue(settings.baseDeliveryFee ?? settings.deliveryFee),
        perKmCharge: toInputValue(settings.perKmCharge),
        sponsorRules: Array.isArray(settings.sponsorRules) ? settings.sponsorRules : [],
        platformFee: toInputValue(settings.platformFee),
        gstRate: toInputValue(settings.gstRate),
      });
    } catch (error) {
      console.error('Failed to load quick fee settings', error);
      showToast('Failed to load fee settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFeeSettings = async () => {
    const baseDistanceKm = toNullableNumber(feeSettings.baseDistanceKm);
    const baseDeliveryFee = toNullableNumber(feeSettings.baseDeliveryFee);
    const perKmCharge = toNullableNumber(feeSettings.perKmCharge);

    if (baseDistanceKm === undefined || baseDistanceKm < 0) {
      showToast('Base distance is required', 'error');
      return;
    }
    if (baseDeliveryFee === undefined || baseDeliveryFee < 0) {
      showToast('Base delivery fee is required', 'error');
      return;
    }
    if (perKmCharge === undefined || perKmCharge < 0) {
      showToast('Per KM charge is required', 'error');
      return;
    }

    try {
      setSavingFeeSettings(true);
      const payload = {
        baseDistanceKm,
        baseDeliveryFee,
        perKmCharge,
        sponsorRules: feeSettings.sponsorRules,
        platformFee: toNullableNumber(feeSettings.platformFee),
        gstRate: toNullableNumber(feeSettings.gstRate),
        isActive: true,
      };
      const response = await adminApi.createOrUpdateFeeSettings(payload);
      const saved = response?.data?.data?.feeSettings;
      if (saved) {
        setFeeSettings({
          baseDistanceKm: toInputValue(saved.baseDistanceKm),
          baseDeliveryFee: toInputValue(saved.baseDeliveryFee ?? saved.deliveryFee),
          perKmCharge: toInputValue(saved.perKmCharge),
          sponsorRules: Array.isArray(saved.sponsorRules) ? saved.sponsorRules : [],
          platformFee: toInputValue(saved.platformFee),
          gstRate: toInputValue(saved.gstRate),
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

  const validateSponsorRuleDraft = () => {
    const minOrderAmount = Number(sponsorRuleDraft.minOrderAmount);
    const maxOrderAmount =
      sponsorRuleDraft.maxOrderAmount === '' ? null : Number(sponsorRuleDraft.maxOrderAmount);
    const maxDistanceKm = Number(sponsorRuleDraft.maxDistanceKm);
    const sponsoredKm =
      sponsorRuleDraft.sponsoredKm === '' ? null : Number(sponsorRuleDraft.sponsoredKm);

    if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) {
      showToast('Minimum order amount must be 0 or more', 'error');
      return null;
    }
    if (maxOrderAmount != null && (!Number.isFinite(maxOrderAmount) || maxOrderAmount < minOrderAmount)) {
      showToast('Maximum order amount must be greater than or equal to minimum order amount', 'error');
      return null;
    }
    if (!Number.isFinite(maxDistanceKm) || maxDistanceKm < 0) {
      showToast('Maximum distance must be 0 or more', 'error');
      return null;
    }
    if (sponsorRuleDraft.sponsorType === 'SPLIT' && (!Number.isFinite(sponsoredKm) || sponsoredKm < 0)) {
      showToast('Sponsored KM is required for split rules', 'error');
      return null;
    }

    return {
      minOrderAmount,
      maxOrderAmount,
      maxDistanceKm,
      sponsorType: sponsorRuleDraft.sponsorType,
      sponsoredKm: sponsorRuleDraft.sponsorType === 'SPLIT' ? sponsoredKm : null,
    };
  };

  const handleAddSponsorRule = () => {
    const nextRule = validateSponsorRuleDraft();
    if (!nextRule) return;
    setFeeSettings((prev) => ({ ...prev, sponsorRules: [...prev.sponsorRules, nextRule] }));
    setSponsorRuleDraft(EMPTY_SPONSOR_RULE);
    showToast('Sponsor rule added', 'success');
  };

  const handleEditSponsorRule = (index) => {
    const rule = feeSettings.sponsorRules[index];
    if (!rule) return;
    setEditingSponsorRuleIndex(index);
    setSponsorRuleDraft({
      minOrderAmount: toInputValue(rule.minOrderAmount),
      maxOrderAmount: toInputValue(rule.maxOrderAmount),
      maxDistanceKm: toInputValue(rule.maxDistanceKm),
      sponsorType: rule.sponsorType || 'USER_FULL',
      sponsoredKm: toInputValue(rule.sponsoredKm),
    });
  };

  const handleSaveSponsorRule = () => {
    const nextRule = validateSponsorRuleDraft();
    if (!nextRule) return;
    setFeeSettings((prev) => ({
      ...prev,
      sponsorRules: prev.sponsorRules.map((rule, index) => (index === editingSponsorRuleIndex ? nextRule : rule)),
    }));
    setEditingSponsorRuleIndex(null);
    setSponsorRuleDraft(EMPTY_SPONSOR_RULE);
    showToast('Sponsor rule updated', 'success');
  };

  const handleDeleteSponsorRule = (index) => {
    setFeeSettings((prev) => ({
      ...prev,
      sponsorRules: prev.sponsorRules.filter((_, idx) => idx !== index),
    }));
    if (editingSponsorRuleIndex === index) {
      setEditingSponsorRuleIndex(null);
      setSponsorRuleDraft(EMPTY_SPONSOR_RULE);
    }
  };

  const handleCancelSponsorRuleEdit = () => {
    setEditingSponsorRuleIndex(null);
    setSponsorRuleDraft(EMPTY_SPONSOR_RULE);
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
              <Settings className="h-5 w-5 text-[#6412c6]" />
              Fee Settings
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Distance-based delivery pricing, sponsor rules, platform fee, and GST — same model as Food's fee settings.
            </p>
          </div>
          <button
            onClick={handleSaveFeeSettings}
            disabled={loading || savingFeeSettings}
            className={cn(
              'inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white',
              savingFeeSettings ? 'bg-[#9359d7]' : 'bg-[#6412c6] hover:bg-[#550fa8]',
            )}
          >
            {savingFeeSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Settings
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[#6412c6]" />
          </div>
        ) : (
          <div className="space-y-8 p-6">
            <div className="rounded-3xl border border-slate-200 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Truck className="h-5 w-5 text-[#6412c6]" />
                <h3 className="text-base font-bold text-slate-900">Base Delivery Config</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">Base Distance (KM)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={feeSettings.baseDistanceKm}
                    onChange={(e) => setFeeSettings((prev) => ({ ...prev, baseDistanceKm: e.target.value }))}
                    placeholder="3"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#6412c6]"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">Base Delivery Fee (Rs)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={feeSettings.baseDeliveryFee}
                    onChange={(e) => setFeeSettings((prev) => ({ ...prev, baseDeliveryFee: e.target.value }))}
                    placeholder="25"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#6412c6]"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">Per KM Charge (Rs)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={feeSettings.perKmCharge}
                    onChange={(e) => setFeeSettings((prev) => ({ ...prev, perKmCharge: e.target.value }))}
                    placeholder="10"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#6412c6]"
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Platform Fee (Rs)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={feeSettings.platformFee}
                  onChange={(e) => setFeeSettings((prev) => ({ ...prev, platformFee: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#6412c6]"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">GST Rate (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={feeSettings.gstRate}
                  onChange={(e) => setFeeSettings((prev) => ({ ...prev, gstRate: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#6412c6]"
                />
              </label>
            </div>

            <div className="rounded-3xl border border-slate-200 p-5">
              <div className="mb-2">
                <h3 className="text-base font-bold text-slate-900">Dynamic Delivery Sponsor Rules</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Decide who pays the delivery fee — the customer, the seller, or a split — based on order value and distance.
                  If no rule matches, the default is <strong className="text-slate-700">USER_FULL</strong>.
                </p>
              </div>

              {feeSettings.sponsorRules.length > 0 && (
                <div className="mb-5 mt-4 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-slate-500">
                        <th className="px-3 py-3 font-semibold">Min Order</th>
                        <th className="px-3 py-3 font-semibold">Max Order</th>
                        <th className="px-3 py-3 font-semibold">Max Distance</th>
                        <th className="px-3 py-3 font-semibold">Sponsor Type</th>
                        <th className="px-3 py-3 font-semibold">Sponsored KM</th>
                        <th className="px-3 py-3 text-center font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feeSettings.sponsorRules.map((rule, index) => (
                        <tr key={`${rule.sponsorType}-${index}`} className="border-b border-slate-50">
                          <td className="px-3 py-3">Rs {Number(rule.minOrderAmount || 0).toFixed(2)}</td>
                          <td className="px-3 py-3">
                            {rule.maxOrderAmount == null ? 'No limit' : `Rs ${Number(rule.maxOrderAmount).toFixed(2)}`}
                          </td>
                          <td className="px-3 py-3">{Number(rule.maxDistanceKm || 0).toFixed(2)} KM</td>
                          <td className="px-3 py-3">{rule.sponsorType}</td>
                          <td className="px-3 py-3">
                            {rule.sponsorType === 'SPLIT' ? `${Number(rule.sponsoredKm || 0).toFixed(2)} KM` : '--'}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEditSponsorRule(index)}
                                className="rounded-xl border border-slate-200 p-2 text-[#6412c6] hover:bg-[#f7f3fc]"
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteSponsorRule(index)}
                                className="rounded-xl border border-rose-200 p-2 text-rose-600 hover:bg-rose-50"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Plus className="h-4 w-4 text-[#6412c6]" />
                  <h4 className="text-sm font-semibold text-slate-700">
                    {editingSponsorRuleIndex === null ? 'Add Sponsor Rule' : 'Edit Sponsor Rule'}
                  </h4>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                  <label className="space-y-1">
                    <span className="block text-xs font-medium text-slate-600">Min Order Amount (Rs)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={sponsorRuleDraft.minOrderAmount}
                      onChange={(e) => setSponsorRuleDraft((prev) => ({ ...prev, minOrderAmount: e.target.value }))}
                      placeholder="200"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6412c6]"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-xs font-medium text-slate-600">Max Order Amount (optional)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={sponsorRuleDraft.maxOrderAmount}
                      onChange={(e) => setSponsorRuleDraft((prev) => ({ ...prev, maxOrderAmount: e.target.value }))}
                      placeholder="Leave empty"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6412c6]"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-xs font-medium text-slate-600">Max Distance (KM)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={sponsorRuleDraft.maxDistanceKm}
                      onChange={(e) => setSponsorRuleDraft((prev) => ({ ...prev, maxDistanceKm: e.target.value }))}
                      placeholder="7"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6412c6]"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-xs font-medium text-slate-600">Sponsor Type</span>
                    <select
                      value={sponsorRuleDraft.sponsorType}
                      onChange={(e) => setSponsorRuleDraft((prev) => ({ ...prev, sponsorType: e.target.value }))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6412c6]"
                    >
                      <option value="USER_FULL">USER_FULL</option>
                      <option value="SELLER_FULL">SELLER_FULL</option>
                      <option value="SPLIT">SPLIT</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="block text-xs font-medium text-slate-600">Sponsored KM</span>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={sponsorRuleDraft.sponsoredKm}
                      onChange={(e) => setSponsorRuleDraft((prev) => ({ ...prev, sponsoredKm: e.target.value }))}
                      disabled={sponsorRuleDraft.sponsorType !== 'SPLIT'}
                      placeholder={sponsorRuleDraft.sponsorType === 'SPLIT' ? '3' : 'Only for split'}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6412c6] disabled:bg-slate-100"
                    />
                  </label>
                </div>
                <div className="mt-4 flex justify-end gap-3">
                  {editingSponsorRuleIndex !== null && (
                    <button
                      onClick={handleCancelSponsorRuleEdit}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={editingSponsorRuleIndex === null ? handleAddSponsorRule : handleSaveSponsorRule}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#6412c6] px-4 py-2 text-sm font-bold text-white hover:bg-[#550fa8]"
                  >
                    {editingSponsorRuleIndex === null ? (
                      <>
                        <Plus className="h-4 w-4" />
                        Add Rule
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Save Rule
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

    </div>
  );
}
