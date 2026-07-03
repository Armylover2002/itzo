import mongoose from 'mongoose';

// Sub-schema for structured GPS location data
const locationSchema = new mongoose.Schema({
    address: { type: String },
    coordinates: {
        latitude: { type: Number },
        longitude: { type: Number }
    },
    accuracy: { type: Number },       // GPS accuracy in meters
    timestamp: { type: Date }
}, { _id: false });

const hrmsAttendanceSchema = new mongoose.Schema(
    {
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HrmsEmployee',
            required: true
        },
        date: { type: Date, required: true }, // Normalized to start of day
        
        checkInTime: { type: Date },
        checkOutTime: { type: Date },
        
        // Calculated fields based on HrmsSettings
        workingHours: { type: Number, default: 0 },
        shortHours: { type: Number, default: 0 },
        overtimeHours: { type: Number, default: 0 },
        
        // Status tracking
        status: {
            type: String,
            enum: ['Present', 'Absent', 'Half-Day', 'Leave', 'Holiday', 'Weekend'],
            default: 'Absent'
        },

        // Regularization Flow
        regularization: {
            isRequested: { type: Boolean, default: false },
            requestedCheckInTime: { type: Date },
            requestedCheckOutTime: { type: Date },
            reason: { type: String },
            rejectionReason: { type: String },
            status: { 
                type: String, 
                enum: ['Pending', 'Approved', 'Rejected'], 
                default: 'Pending' 
            },
            approvedBy: { 
                type: mongoose.Schema.Types.ObjectId, 
                ref: 'HrmsEmployee' 
            }
        },

        // ── Location-Based Attendance ──
        // Snapshot of employee type at time of attendance (for historical accuracy)
        employeeType: { type: String, enum: ['Office', 'Field'] },

        // Structured GPS location for check-in/out (replaces old plain string fields)
        checkInLocation: { type: locationSchema },
        checkOutLocation: { type: locationSchema },

        // Office employee validation result
        locationValidation: {
            isValid: { type: Boolean },
            officeLocationId: { type: mongoose.Schema.Types.ObjectId },
            officeName: { type: String },
            distanceFromOffice: { type: Number }  // meters
        },

        // Field employee route tracking summary
        routeDistance: { type: Number, default: 0 },  // total meters traveled
        trackingPointsCount: { type: Number, default: 0 }
    },
    {
        timestamps: true,
        collection: 'hrms_attendance'
    }
);

// Ensure one attendance record per employee per day
hrmsAttendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });
hrmsAttendanceSchema.index({ date: -1 });
hrmsAttendanceSchema.index({ employeeType: 1 });

export const HrmsAttendance = mongoose.model('HrmsAttendance', hrmsAttendanceSchema, 'hrms_attendance');
