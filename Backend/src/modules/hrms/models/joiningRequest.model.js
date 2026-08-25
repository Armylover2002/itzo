import mongoose from 'mongoose';

/**
 * HRMS Joining Request
 * Stores self-registration applications from prospective employees.
 * Only after admin approval does a record move to hrms_employees + FoodAdmin.
 */
const hrmsJoiningRequestSchema = new mongoose.Schema(
    {
        requestId: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        // 1. Personal Details
        fullName: { type: String, required: true, trim: true },
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true
        },
        phone: { type: String, required: true, trim: true },
        password: { type: String, required: true }, // Hashed — stored until approval

        profilePhotoUrl: { type: String },

        dateOfBirth: { type: Date },
        gender: {
            type: String,
            enum: ['Male', 'Female', 'Other', ''],
            default: ''
        },

        // 2. Address
        address: {
            street: { type: String, trim: true },
            city: { type: String, trim: true },
            state: { type: String, trim: true },
            pincode: { type: String, trim: true },
            country: { type: String, default: 'India', trim: true }
        },

        // 3. KYC Documents
        aadhaarNumber: { type: String, trim: true },
        aadhaarPhotoUrl: { type: String },
        panNumber: { type: String, trim: true },
        panPhotoUrl: { type: String },

        // 4. Qualifications & Experience
        qualification: { type: String, trim: true },
        experience: { type: String, trim: true }, // e.g., "3 years in Sales"
        resumeUrl: { type: String },

        // 5. Bank Details
        bankDetails: {
            accountHolderName: { type: String, trim: true },
            accountNumber: { type: String, trim: true },
            bankName: { type: String, trim: true },
            ifscCode: { type: String, trim: true },
            upiId: { type: String, trim: true }
        },

        // 6. Emergency Contact
        emergencyContact: {
            name: { type: String, trim: true },
            relation: { type: String, trim: true },
            phone: { type: String, trim: true }
        },

        // 7. Additional Documents
        documents: [{
            name: { type: String },
            url: { type: String },
            type: { type: String } // e.g., 'Certificate', 'ID Proof'
        }],

        // 8. Expected Role / Position Details
        department: { type: String, trim: true },
        designation: { type: String, trim: true },
        ctc: { type: Number, default: 0 },
        joiningDate: { type: Date },
        hrmsRole: { type: String, enum: ['Employee', 'Manager'], default: 'Employee' },
        shift: { type: String, trim: true, default: 'General' },
        employmentType: { type: String, trim: true, default: 'Full-Time' },
        officeLocation: { type: String, trim: true },
        assignedOfficeLocationId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null
        },
        employeeType: {
            type: String,
            enum: ['Office', 'Field'],
            default: 'Office'
        },

        // 9. Status & Workflow
        status: {
            type: String,
            enum: ['Pending', 'Under_Review', 'Approved', 'Rejected', 'Info_Requested'],
            default: 'Pending'
        },

        // Admin review fields
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodAdmin'
        },
        reviewedAt: { type: Date },
        rejectionReason: { type: String, trim: true },
        infoRequestMessage: { type: String, trim: true },

        // Approval linkage — populated after approval
        approvedEmployeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HrmsEmployee'
        },
        approvedAdminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodAdmin'
        },

        // Audit trail
        statusHistory: [{
            status: { type: String },
            changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodAdmin' },
            changedAt: { type: Date, default: Date.now },
            reason: { type: String }
        }],

        // Assessment Link
        assessmentAttemptId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'AssessmentAttempt'
        }
    },
    {
        timestamps: true,
        collection: 'hrms_joining_requests'
    }
);

// Indexes for fast lookups
hrmsJoiningRequestSchema.index({ email: 1 });
hrmsJoiningRequestSchema.index({ phone: 1 });
hrmsJoiningRequestSchema.index({ status: 1 });
hrmsJoiningRequestSchema.index({ createdAt: -1 });

export const HrmsJoiningRequest = mongoose.model(
    'HrmsJoiningRequest',
    hrmsJoiningRequestSchema,
    'hrms_joining_requests'
);
