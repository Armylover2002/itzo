import mongoose from 'mongoose';

const jobApplicationSchema = new mongoose.Schema(
    {
        applicantName: { type: String, required: true, trim: true },
        email: { type: String, required: true, trim: true, lowercase: true, index: true },
        mobile: { type: String, required: true, trim: true },
        alternateMobile: { type: String, trim: true, default: '' },
        dob: { type: Date },
        gender: { type: String, trim: true, default: '' },
        address: { type: String, trim: true, default: '' },
        city: { type: String, required: true, trim: true },
        state: { type: String, required: true, trim: true },
        country: { type: String, trim: true, default: '' },
        qualification: { type: String, required: true, trim: true },
        college: { type: String, trim: true, default: '' },
        passingYear: { type: String, trim: true, default: '' },
        company: { type: String, trim: true, default: '' },
        designation: { type: String, trim: true, default: '' },
        experience: { type: String, trim: true, default: '' },
        currentCTC: { type: String, trim: true, default: '' },
        expectedCTC: { type: String, trim: true, default: '' },
        noticePeriod: { type: String, trim: true, default: '' },
        preferredLocation: { type: String, trim: true, default: '' },
        skills: { type: [String], default: [] },
        certifications: { type: [String], default: [] },
        languages: { type: [String], default: [] },
        linkedin: { type: String, trim: true, default: '' },
        github: { type: String, trim: true, default: '' },
        portfolio: { type: String, trim: true, default: '' },
        whyJoin: { type: String, trim: true, default: '' },
        about: { type: String, trim: true, default: '' },
        resumeUrl: { type: String, required: true, trim: true },
        coverLetterUrl: { type: String, trim: true, default: '' },
        additionalFiles: { type: [String], default: [] },
        jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
        jobTitle: { type: String, required: true, trim: true },
        department: { type: String, required: true, trim: true },
        status: {
            type: String,
            enum: ['Applied', 'Shortlisted', 'Interview Scheduled', 'Rejected', 'Hired'],
            default: 'Applied',
            index: true
        },
        appliedAt: { type: Date, default: Date.now, index: true },
        reviewedAt: { type: Date },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodAdmin' },
        remarks: { type: String, trim: true, default: '' }
    },
    {
        collection: 'job_applications',
        timestamps: true
    }
);

jobApplicationSchema.index({ jobId: 1, email: 1 });
jobApplicationSchema.index({ appliedAt: -1 });

export const JobApplication = mongoose.model('JobApplication', jobApplicationSchema, 'job_applications');
