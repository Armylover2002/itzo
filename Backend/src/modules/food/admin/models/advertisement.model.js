import mongoose from 'mongoose';

const ADS_TYPES = [
    'Video Promotion',
    'Restaurant Promotion',
    'Image Promotion',
    'Banner Promotion'
];

const advertisementSchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodRestaurant',
            required: true,
            index: true
        },
        restaurantName: { type: String, required: true },
        restaurantEmail: { type: String, default: '' },
        adsId: { type: String, required: true, unique: true, index: true },
        title: { type: String, required: true, trim: true },
        description: { type: String, default: '' },
        adsType: {
            type: String,
            enum: ADS_TYPES,
            required: true
        },
        fileDescription: { type: String, default: '' },
        videoDescription: { type: String, default: '' },
        imageUrl: { type: String, default: '' },
        imagePublicId: { type: String, default: '' },
        videoUrl: { type: String, default: '' },
        videoPublicId: { type: String, default: '' },
        validity: { type: String, default: '' },
        startDate: { type: Date, default: null },
        endDate: { type: Date, default: null },
        priority: {
            type: String,
            enum: ['1', '2', '3'],
            default: '2'
        },
        status: {
            type: String,
            enum: ['Pending', 'Approved', 'Rejected', 'Paused'],
            default: 'Pending',
            index: true
        },
        requestType: {
            type: String,
            enum: ['new', 'update'],
            default: 'new',
            index: true
        },
        isDeleted: { type: Boolean, default: false, index: true }
    },
    { collection: 'food_advertisements', timestamps: true }
);

advertisementSchema.index({ restaurantId: 1, isDeleted: 1, createdAt: -1 });
advertisementSchema.index({ status: 1, requestType: 1, isDeleted: 1 });

export const ADS_TYPE_OPTIONS = ADS_TYPES;
export const FoodAdvertisement = mongoose.model(
    'FoodAdvertisement',
    advertisementSchema,
    'food_advertisements'
);
