import mongoose from 'mongoose';

const channelFlagsSchema = new mongoose.Schema(
    {
        push: { type: Boolean, default: true },
        mail: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        inApp: { type: Boolean, default: true }
    },
    { _id: false }
);

const topicSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, trim: true },
        topic: { type: String, required: true, trim: true },
        description: { type: String, default: '', trim: true },
        channels: { type: channelFlagsSchema, default: () => ({}) },
        pushAvailable: { type: Boolean, default: true },
        mailAvailable: { type: Boolean, default: true },
        smsAvailable: { type: Boolean, default: true }
    },
    { _id: false }
);

const notificationChannelSchema = new mongoose.Schema(
    {
        role: {
            type: String,
            enum: ['admin', 'restaurant', 'customers', 'deliveryman'],
            required: true,
            unique: true,
            index: true
        },
        topics: {
            type: [topicSchema],
            default: []
        }
    },
    {
        collection: 'food_notification_channels',
        timestamps: true
    }
);

// Explicit unique index name for Atlas / autoIndex:false environments.
notificationChannelSchema.index({ role: 1 }, { unique: true, name: 'role_1' });

export const NotificationChannelSettings = mongoose.model(
    'NotificationChannelSettings',
    notificationChannelSchema
);
