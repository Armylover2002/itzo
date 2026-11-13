import mongoose from 'mongoose';

export const MAINTENANCE_DEFAULT_MESSAGE = 'We are coming soon. The app is on maintenance.';

/**
 * Admin kill-switch for customer ordering on the Food module. Singleton document —
 * the unique `singletonKey` makes the get-or-create upsert race-proof, same as
 * GlobalSettings. Keeping this out of GlobalSettings on purpose: the toggle lives on
 * the food dashboard and must stay editable without `global::settings` permission.
 */
const maintenanceModeSchema = new mongoose.Schema(
    {
        singletonKey: { type: String, default: 'food', unique: true },
        enabled: { type: Boolean, default: false },
        message: { type: String, default: MAINTENANCE_DEFAULT_MESSAGE },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodAdmin', default: null },
    },
    { timestamps: true }
);

maintenanceModeSchema.statics.getSingleton = function () {
    return this.findOneAndUpdate(
        { singletonKey: 'food' },
        { $setOnInsert: { singletonKey: 'food' } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
};

export const FoodMaintenanceMode = mongoose.model(
    'FoodMaintenanceMode',
    maintenanceModeSchema,
    'food_maintenance_mode'
);
