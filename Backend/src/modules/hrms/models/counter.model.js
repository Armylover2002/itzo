import mongoose from 'mongoose';

/**
 * Atomic counter for generating sequential HRMS identifiers.
 * Uses findOneAndUpdate with $inc to prevent race conditions.
 */
const hrmsCounterSchema = new mongoose.Schema(
    {
        _id: { type: String, required: true }, // e.g., 'employeeId', 'joiningRequestId'
        seq: { type: Number, default: 0 }
    },
    {
        collection: 'hrms_counters',
        versionKey: false
    }
);

export const HrmsCounter = mongoose.model('HrmsCounter', hrmsCounterSchema, 'hrms_counters');

/**
 * Get next sequential value for a given counter key.
 * Thread-safe via atomic $inc operation.
 */
export const getNextSequence = async (counterKey, session = null) => {
    const options = { new: true, upsert: true };
    if (session) options.session = session;

    const counter = await HrmsCounter.findOneAndUpdate(
        { _id: counterKey },
        { $inc: { seq: 1 } },
        options
    );
    return counter.seq;
};
