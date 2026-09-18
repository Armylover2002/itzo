import mongoose from 'mongoose';

const hrmsSettingsSchema = new mongoose.Schema(
    {
        // 1. Company Policies & Working Hours
        workingHours: {
            minimumWorkingHours: { type: Number, default: 8 },
            gracePeriodMinutes: { type: Number, default: 15 },
            shortHourDeductionRate: { type: Number, default: 1 },
            overtimeRate: { type: Number, default: 1.5 },
        },

        // 2. Leave Policies
        leavePolicies: {
            paidLeavesPerMonth: { type: Number, default: 4 },
            maxAccumulatedLeaves: { type: Number, default: 48 },
            leaveTypes: [{
                name: { type: String, required: true },
                isPaid: { type: Boolean, default: true }
            }],
            requiresManagerApproval: { type: Boolean, default: true },
        },

        // 3. Payroll Rules
        payrollRules: {
            lopMultiplier: { type: Number, default: 1 },
            salaryCalculationType: { type: String, enum: ['Fixed', 'Attendance_Based'], default: 'Attendance_Based' },
            payPeriod: { type: String, enum: ['Monthly', 'Bi-Weekly'], default: 'Monthly' },
        },

        // 4. Expenses & Travel Policies
        expensePolicies: {
            categories: [{ type: String }],
            maxHotelAllowancePerNight: { type: Number, default: 2000 },
            maxFoodAllowancePerDay: { type: Number, default: 500 },
            travelRatePerKm: { type: Number, default: 5 },
            requiresReceiptAbove: { type: Number, default: 500 },
        },

        // 5. Organizational Structure
        organization: {
            departments: [{
                name: { type: String, required: true },
                headAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodAdmin' }
            }],
            designations: [{ type: String }],
            officeLocations: [{
                name: { type: String, required: true },
                address: { type: String },
                city: { type: String },
                latitude: { type: Number },
                longitude: { type: Number },
                radiusMeters: { type: Number, default: 200 },
                isActive: { type: Boolean, default: true }
            }],
            zones: [{ type: String }],
        },

        // 6. Shifts
        shifts: [{
            name: { type: String, required: true },
            startTime: { type: String }, // "09:00"
            endTime: { type: String }    // "18:00"
        }],

        // 7. Document Types
        documentTypes: [{ type: String }],

        // 8. Holiday Calendar
        holidayCalendar: [{
            date: { type: Date, required: true },
            name: { type: String, required: true },
            isOptional: { type: Boolean, default: false }
        }],

        // 9. Templates
        templates: {
            offerLetterHtml: { type: String, default: '<h1>Offer Letter</h1>' },
            salarySlipHtml: { type: String, default: '<h1>Payslip</h1>' },
            welcomeEmailHtml: { type: String, default: '<h1>Welcome to ItzoFood</h1>' }
        },

        // 10. Location Tracking Settings (for Field employees & Office validation)
        trackingSettings: {
            enableLiveTracking: { type: Boolean, default: true },
            trackingIntervalSeconds: { type: Number, default: 60 },
            gpsAccuracyThreshold: { type: Number, default: 50 },  // meters
            allowMockLocation: { type: Boolean, default: false },
            allowOfflineAttendance: { type: Boolean, default: false },
            locationRetentionDays: { type: Number, default: 90 }
        },

        // 10. Company Branding & Details
        companyInfo: {
            companyName: { type: String, default: 'ItzoFood' },
            companyAddress: { type: String, default: '123 Tech Park, Bangalore, India' },
            supportEmail: { type: String, default: 'support@itzofood.com' },
            supportPhone: { type: String, default: '' },
            companyLogoUrl: { type: String, default: '' },
            currency: { type: String, default: 'INR' },
            currencySymbol: { type: String, default: '₹' },
        },

        // 11. Audit & Modification Tracking
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodAdmin'
        }
    },
    {
        timestamps: true,
        collection: 'hrms_settings'
    }
);

export const HrmsSettings = mongoose.model('HrmsSettings', hrmsSettingsSchema, 'hrms_settings');
