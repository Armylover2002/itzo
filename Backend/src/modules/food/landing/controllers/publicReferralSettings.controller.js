import * as adminService from '../../admin/services/admin.service.js';

export async function getPublicReferralSettingsController(req, res, next) {
    try {
        const data = await adminService.getReferralSettings();
        const settings = data?.referralSettings || null;
        // Expose only the fields needed by clients.
        const payload = settings
            ? {
                user: {
                    referrerReward: Number(settings.user?.referrerReward) || 0,
                    refereeReward: Number(settings.user?.refereeReward) || 0,
                    limit: Number(settings.user?.limit) || 0
                },
                delivery: {
                    referrerReward: Number(settings.delivery?.referrerReward) || 0,
                    refereeReward: Number(settings.delivery?.refereeReward) || 0,
                    limit: Number(settings.delivery?.limit) || 0
                }
            }
            : null;
        return res.status(200).json({ success: true, message: 'Referral settings fetched successfully', data: { referralSettings: payload } });
    } catch (error) {
        next(error);
    }
}

