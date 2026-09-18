import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true, index: true },
        role: { type: String, required: true, trim: true },
        department: { type: String, required: true, trim: true, index: true },
        location: { type: String, required: true, trim: true, index: true },
        employmentType: { 
            type: String, 
            enum: ['Full Time', 'Part Time', 'Contract', 'Internship', 'Temporary'], 
            required: true 
        },
        experienceRequired: { type: String, trim: true, required: true },
        salaryRange: { type: String, trim: true, required: true },
        numberOfOpenings: { type: Number, default: 1 },
        shortDescription: { type: String, required: true, trim: true },
        detailedDescription: { type: String, required: true },
        responsibilities: [{ type: String, trim: true }],
        requirements: [{ type: String, trim: true }],
        benefits: [{ type: String, trim: true }],
        posterImage: { type: String, trim: true, default: '' },
        applicationFormLink: { type: String, trim: true, default: '' },
        contactEmail: { type: String, trim: true },
        contactPhone: { type: String, trim: true },
        hiringManagerName: { type: String, trim: true },
        displayOrder: { type: Number, default: 0 },
        featuredJob: { type: Boolean, default: false, index: true },
        status: { 
            type: String, 
            enum: ['Active', 'Inactive', 'Draft', 'Closed'], 
            default: 'Active', 
            index: true 
        },
        publishDate: { type: Date, default: Date.now },
        expiryDate: { type: Date },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
    },
    {
        collection: 'jobs',
        timestamps: true
    }
);

jobSchema.index({ status: 1, publishDate: -1 });
jobSchema.index({ featuredJob: 1, status: 1 });
jobSchema.index({ department: 1, status: 1 });

export const Job = mongoose.model('Job', jobSchema, 'jobs');
