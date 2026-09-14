import mongoose from 'mongoose';
import {
  validateFeeSettingsUpsertDto,
  validateOptionalStatusDto,
} from '../admin/validators/billing.validator.js';
import * as billingService from '../admin/services/billing.service.js';
import { getDeliveryCashLimitSettings } from '../../food/admin/services/admin.service.js';


export async function getFeeSettings(req, res, next) {
  try {
    const data = await billingService.getFeeSettings();
    res.status(200).json({ success: true, message: 'Fee settings fetched successfully', data });
  } catch (error) {
    next(error);
  }
}

export async function createOrUpdateFeeSettings(req, res, next) {
  try {
    const body = validateFeeSettingsUpsertDto(req.body || {});
    const feeSettings = await billingService.upsertFeeSettings(body);
    res.status(200).json({ success: true, message: 'Fee settings saved successfully', data: { feeSettings } });
  } catch (error) {
    next(error);
  }
}

export async function getPublicBillingSettings(req, res, next) {
  try {
    const { feeSettings } = await billingService.getFeeSettings();
    const cashLimitSettings = await getDeliveryCashLimitSettings();
    const codOrderLimit = Number(cashLimitSettings?.deliveryCashLimit || 0);
    
    const enrichedSettings = {
      ...(feeSettings || {}),
      codOrderLimit: Number.isFinite(codOrderLimit) && codOrderLimit > 0 ? codOrderLimit : null,
    };

    res.status(200).json({
      success: true,
      message: 'Billing settings fetched successfully',
      result: enrichedSettings,
      data: { feeSettings: enrichedSettings },
    });
  } catch (error) {
    next(error);
  }
}
