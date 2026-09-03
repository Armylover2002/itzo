import {
  validateFeeSettingsUpsertDto,
} from '../admin/validators/billing.validator.js';
import * as billingService from '../admin/services/billing.service.js';

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
    res.status(200).json({
      success: true,
      message: 'Billing settings fetched successfully',
      result: feeSettings,
      data: { feeSettings },
    });
  } catch (error) {
    next(error);
  }
}
