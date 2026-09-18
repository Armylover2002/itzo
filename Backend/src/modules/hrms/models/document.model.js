import mongoose from 'mongoose';

/**
 * HRMS Document Management
 * Stores all employee documents: offer letters, payslips, KYC, certificates, etc.
 */
const hrmsDocumentSchema = new mongoose.Schema(
    {
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HrmsEmployee',
            required: true
        },
        documentType: {
            type: String,
            required: true,
            trim: true
            // e.g., 'Offer Letter', 'Payslip', 'Aadhaar', 'PAN', 'Certificate', 'Other'
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        url: {
            type: String,
            required: true
        },
        publicId: { type: String }, // Cloudinary public ID for deletion

        // For payslips — month/year reference
        month: { type: Number }, // 1-12
        year: { type: Number },

        // Metadata
        fileSize: { type: Number }, // bytes
        mimeType: { type: String },
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodAdmin'
        },
        isVerified: { type: Boolean, default: false },
        remarks: { type: String, trim: true }
    },
    {
        timestamps: true,
        collection: 'hrms_documents'
    }
);

hrmsDocumentSchema.index({ employeeId: 1 });
hrmsDocumentSchema.index({ documentType: 1 });
hrmsDocumentSchema.index({ employeeId: 1, documentType: 1 });

/**
 * Static helper: Self-healing sync to ensure all URLs stored on HrmsEmployee (Aadhaar, PAN, Offer Letter, Resume, Photo)
 * also exist as standalone entries inside the hrms_documents table.
 */
hrmsDocumentSchema.statics.syncEmployeeDocuments = async function(employee) {
    if (!employee || !employee._id) return [];
    try {
        const existingDocs = await this.find({ employeeId: employee._id }).lean();
        const existingUrls = new Set(existingDocs.map(d => d.url).filter(Boolean));
        const toCreate = [];

        const addDocIfMissing = (url, type, name) => {
            if (url && typeof url === 'string' && url.trim() && !existingUrls.has(url.trim())) {
                toCreate.push({
                    employeeId: employee._id,
                    documentType: type,
                    name: name,
                    url: url.trim(),
                    uploadedBy: employee.adminId?._id || employee.adminId || null,
                    isVerified: true
                });
                existingUrls.add(url.trim());
            }
        };

        if (employee.documents?.aadhaarPhotoUrl) {
            addDocIfMissing(employee.documents.aadhaarPhotoUrl, 'Aadhaar', 'Aadhaar Card');
        }
        if (employee.documents?.panPhotoUrl) {
            addDocIfMissing(employee.documents.panPhotoUrl, 'PAN', 'PAN Card');
        }
        if (employee.offerLetterUrl) {
            addDocIfMissing(employee.offerLetterUrl, 'Offer Letter', 'Offer Letter');
        }
        if (employee.resumeUrl) {
            addDocIfMissing(employee.resumeUrl, 'Resume', 'Resume / CV');
        }
        if (employee.profilePhotoUrl) {
            addDocIfMissing(employee.profilePhotoUrl, 'Other', 'Profile Photo');
        }

        if (toCreate.length > 0) {
            return await this.insertMany(toCreate);
        }
    } catch (e) {
        console.error('Document sync error:', e.message);
    }
    return [];
};

export const HrmsDocument = mongoose.model('HrmsDocument', hrmsDocumentSchema, 'hrms_documents');
