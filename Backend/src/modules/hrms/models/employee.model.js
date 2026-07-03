import mongoose from 'mongoose';

const hrmsEmployeeSchema = new mongoose.Schema(
    {
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodAdmin',
            required: true,
            unique: true
        },
        employeeId: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        // HRMS Role distinction (Manager vs Employee vs HR)
        hrmsRole: {
            type: String,
            enum: ['Employee', 'Manager', 'HR'],
            default: 'Employee'
        },

        // 1. Professional Details
        department: { type: String, trim: true },
        designation: { type: String, trim: true },
        managerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HrmsEmployee'
        },
        teamHistory: [{
            managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrmsEmployee' },
            assignedAt: { type: Date, default: Date.now },
            removedAt: { type: Date }
        }],
        employmentType: {
            type: String,
            enum: ['Full-Time', 'Part-Time', 'Contract', 'Intern'],
            default: 'Full-Time'
        },

        // Employee Type: Office (location-restricted) vs Field (mobile/tracked)
        employeeType: {
            type: String,
            enum: ['Office', 'Field'],
            default: 'Office'
        },
        // Reference to a specific office in HrmsSettings.organization.officeLocations
        assignedOfficeLocationId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null
        },
        joiningDate: { type: Date, required: true },
        shift: { type: String, default: 'General' },
        officeLocation: { type: String, trim: true },
        zone: { type: String, trim: true },

        // 2. Compensation
        ctc: { type: Number, default: 0 },
        monthlySalary: { type: Number, default: 0 },

        // 3. Profile Photo
        profilePhotoUrl: { type: String },

        // 4. KYC & Documents
        documents: {
            aadhaarNumber: { type: String, trim: true },
            aadhaarPhotoUrl: { type: String },
            panNumber: { type: String, trim: true },
            panPhotoUrl: { type: String },
            offerLetterUrl: { type: String },
            otherDocuments: [{
                name: { type: String },
                url: { type: String }
            }]
        },

        // 5. Bank Details
        bankDetails: {
            accountHolderName: { type: String, trim: true },
            accountNumber: { type: String, trim: true },
            bankName: { type: String, trim: true },
            ifscCode: { type: String, trim: true },
            upiId: { type: String, trim: true }
        },

        // 6. Personal & Emergency
        address: {
            street: { type: String, trim: true },
            city: { type: String, trim: true },
            state: { type: String, trim: true },
            pincode: { type: String, trim: true },
            country: { type: String, default: 'India', trim: true }
        },
        emergencyContact: {
            name: { type: String, trim: true },
            relation: { type: String, trim: true },
            phone: { type: String, trim: true }
        },

        // 7. Qualifications
        qualification: { type: String, trim: true },
        experience: { type: String, trim: true },

        // 8. Source tracking (from joining request or direct onboard)
        joiningRequestId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HrmsJoiningRequest'
        },

        // 9. Profile Edit Requests
        profileEditStatus: {
            type: String,
            enum: ['None', 'Pending', 'Rejected'],
            default: 'None'
        },
        profileEditRejectionReason: { type: String },
        pendingProfileEdit: { type: Object },

        status: {
            type: String,
            enum: ['Active', 'Suspended', 'Resigned', 'Terminated'],
            default: 'Active'
        }
    },
    {
        timestamps: true,
        collection: 'hrms_employees'
    }
);

// Auto-derive monthly salary from CTC
hrmsEmployeeSchema.pre('save', function (next) {
    if (this.isModified('ctc') && this.ctc > 0) {
        this.monthlySalary = Math.round((this.ctc / 12) * 100) / 100;
    }
    next();
});

// Indexes for fast querying
hrmsEmployeeSchema.index({ adminId: 1 });
hrmsEmployeeSchema.index({ managerId: 1 });
hrmsEmployeeSchema.index({ employeeId: 1 });
hrmsEmployeeSchema.index({ status: 1 });
hrmsEmployeeSchema.index({ hrmsRole: 1 });
hrmsEmployeeSchema.index({ department: 1 });
hrmsEmployeeSchema.index({ employeeType: 1 });

export const HrmsEmployee = mongoose.model('HrmsEmployee', hrmsEmployeeSchema, 'hrms_employees');
