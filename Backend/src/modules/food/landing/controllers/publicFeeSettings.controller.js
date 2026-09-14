import * as adminService from '../../admin/services/admin.service.js';

function toPublicFeeSettings(settings) {
  if (!settings || typeof settings !== 'object') return null;
  return {
    deliveryFee: settings.deliveryFee ?? settings.baseDeliveryFee ?? null,
    baseDistanceKm: settings.baseDistanceKm ?? null,
    baseDeliveryFee: settings.baseDeliveryFee ?? settings.deliveryFee ?? null,
    perKmCharge: settings.perKmCharge ?? null,
    platformFee: settings.platformFee ?? null,
    packagingFee: settings.packagingFee ?? null,
    gstRate: settings.gstRate ?? null,
    deliveryFeeRanges: Array.isArray(settings.deliveryFeeRanges)
      ? settings.deliveryFeeRanges
      : [],
    deliveryDistanceSlabs: Array.isArray(settings.deliveryDistanceSlabs)
      ? settings.deliveryDistanceSlabs
      : [],
    mixedOrderDistanceLimit: settings.mixedOrderDistanceLimit ?? null,
    mixedOrderAngleLimit: settings.mixedOrderAngleLimit ?? null,
    codOrderLimit: settings.codOrderLimit ?? null,
    isActive: settings.isActive !== false,
  };
}

export async function getPublicFeeSettingsController(req, res, next) {
  try {
    const data = await adminService.getFeeSettings();
    const cashLimitSettings = await adminService.getDeliveryCashLimitSettings();
    const codOrderLimit = Number(cashLimitSettings?.deliveryCashLimit || 0);
    const feeSettings = toPublicFeeSettings({
      ...(data?.feeSettings || null),
      codOrderLimit: Number.isFinite(codOrderLimit) && codOrderLimit > 0 ? codOrderLimit : null,
    });
    return res.status(200).json({
      success: true,
      message: 'Fee settings fetched successfully',
      data: { feeSettings },
    });
  } catch (error) {
    next(error);
  }
}
