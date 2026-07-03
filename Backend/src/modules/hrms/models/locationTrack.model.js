import mongoose from 'mongoose';

/**
 * HRMS Location Track
 * Stores GPS breadcrumbs for Field employees during active shifts.
 * One document per employee per day — points are batch-appended.
 * Supports TTL-based auto-purge via configurable retention.
 */
const locationPointSchema = new mongoose.Schema({
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number },        // GPS accuracy in meters
    speed: { type: Number },           // m/s if available
    timestamp: { type: Date, default: Date.now }
}, { _id: false });

const hrmsLocationTrackSchema = new mongoose.Schema(
    {
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HrmsEmployee',
            required: true
        },
        attendanceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HrmsAttendance',
            required: true
        },
        date: { type: Date, required: true },  // Normalized to start of day

        // Batched GPS points — appended via $push
        points: [locationPointSchema],

        // Route summary (updated on check-out or periodically)
        totalDistance: { type: Number, default: 0 },   // meters
        totalPoints: { type: Number, default: 0 },

        // TTL support — set this to (date + retentionDays) for auto-purge
        expiresAt: { type: Date }
    },
    {
        timestamps: true,
        collection: 'hrms_location_tracks'
    }
);

// One track per employee per day
hrmsLocationTrackSchema.index({ employeeId: 1, date: 1 }, { unique: true });
hrmsLocationTrackSchema.index({ attendanceId: 1 });
hrmsLocationTrackSchema.index({ date: -1 });

// TTL index — MongoDB auto-deletes documents after expiresAt
hrmsLocationTrackSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const HrmsLocationTrack = mongoose.model(
    'HrmsLocationTrack',
    hrmsLocationTrackSchema,
    'hrms_location_tracks'
);
