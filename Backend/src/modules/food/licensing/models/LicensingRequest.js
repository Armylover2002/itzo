import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
    aadhaar: { type: String, default: '' },
    pan: { type: String, default: '' },
    existingFssai: { type: String, default: '' },
    existingGst: { type: String, default: '' },
    shopImage: { type: String, default: '' },
    restaurantPhoto: { type: String, default: '' },
    otherDocs: { type: [String], default: [] }
}, { _id: false });

const licensingRequestSchema = new mongoose.Schema({
    vendor: { type: String, required: true },
    restaurantName: { type: String, required: true },
    ownerName: { type: String, required: true },
    city: { type: String, required: true },
    address: { type: String, default: '' },
    restaurantId: { type: String, default: '' },
    gstNumber: { type: String, default: '' },
    mobile: { type: String, required: true },
    email: { type: String, required: true },
    selectedLicenses: { type: [String], required: true },
    otherLicenseText: { type: String, default: '' },
    uploadedDocuments: { type: documentSchema, default: () => ({}) },
    termsAccepted: { type: Boolean, required: true, default: false },
    status: {
        type: String,
        required: true,
        enum: ['Pending', 'Contacted', 'In Progress', 'Completed', 'Rejected'],
        default: 'Pending'
    },
    adminRemarks: { type: String, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodAdmin', default: null },
    reviewedAt: { type: Date, default: null }
}, {
    timestamps: true
});

// Create index to support quick duplicate checking (e.g. within 5 minutes)
licensingRequestSchema.index({ email: 1, vendor: 1, createdAt: -1 });

export const LicensingRequest = mongoose.model('LicensingRequest', licensingRequestSchema, 'licensing_requests');
