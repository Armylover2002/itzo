import { ValidationError } from '../../../../core/auth/errors.js';
import { DiningSettings } from '../models/diningSettings.model.js';

/** There is always exactly one settings doc — created lazily on first read/write. */
export async function getDiningSettings() {
    const settings = await DiningSettings.findOneAndUpdate(
        { key: 'global' },
        { $setOnInsert: { key: 'global' } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    return settings;
}

export async function updateDiningSettings(body = {}) {
    const update = {};

    if (body.defaultCommission && typeof body.defaultCommission === 'object') {
        const type = body.defaultCommission.type === 'amount' ? 'amount' : 'percentage';
        const value = Number(body.defaultCommission.value);
        if (!Number.isFinite(value) || value < 0) {
            throw new ValidationError('Commission value must be a non-negative number');
        }
        if (type === 'percentage' && value > 100) {
            throw new ValidationError('Percentage commission cannot exceed 100');
        }
        update.defaultCommission = { type, value };
    }

    for (const key of ['minAdvanceBookingMinutes', 'maxAdvanceBookingDays', 'cancellationWindowMinutes', 'taxPercent']) {
        if (body[key] !== undefined) {
            const value = Number(body[key]);
            if (!Number.isFinite(value) || value < 0) {
                throw new ValidationError(`${key} must be a non-negative number`);
            }
            update[key] = value;
        }
    }

    const settings = await DiningSettings.findOneAndUpdate(
        { key: 'global' },
        { $set: update, $setOnInsert: { key: 'global' } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    return settings;
}
