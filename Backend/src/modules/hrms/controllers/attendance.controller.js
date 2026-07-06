import { HrmsAttendance } from '../models/attendance.model.js';
import { HrmsEmployee } from '../models/employee.model.js';
import { HrmsSettings } from '../models/settings.model.js';
import { HrmsLocationTrack } from '../models/locationTrack.model.js';
import { sendResponse, sendError } from '../../../utils/response.js';
import {
    haversineDistance,
    isValidCoordinate,
    isSuspiciousMockLocation,
    reverseGeocode
} from '../services/geoUtils.js';

const getNormalizedDate = (date = new Date()) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

/**
 * EMPLOYEE: Check In with GPS validation
 * - Office employees: must be within assigned office radius
 * - Field employees: always allowed, starts tracking
 */
export const checkIn = async (req, res, next) => {
    try {
        const { latitude, longitude, accuracy } = req.body;

        const employee = await HrmsEmployee.findOne({ adminId: req.user.userId });
        if (!employee) return sendError(res, 404, 'Employee not found');
        if (employee.status !== 'Active') return sendError(res, 403, 'Employee account is not active');

        const settings = await HrmsSettings.findOne().lean();
        const trackingSettings = settings?.trackingSettings || {};

        // GPS validation
        if (latitude !== undefined && longitude !== undefined) {
            if (!isValidCoordinate(latitude, longitude)) {
                return sendError(res, 400, 'Invalid GPS coordinates');
            }
            if (isSuspiciousMockLocation(accuracy, trackingSettings.allowMockLocation)) {
                return sendError(res, 403, 'Mock/spoofed location detected. Attendance rejected.');
            }
        }

        const today = getNormalizedDate();
        let attendance = await HrmsAttendance.findOne({ employeeId: employee._id, date: today });

        if (attendance && attendance.checkInTime) {
            return sendError(res, 400, 'Already checked in today');
        }

        if (!attendance) {
            attendance = new HrmsAttendance({ employeeId: employee._id, date: today });
        }

        // Snapshot employee type for historical record
        attendance.employeeType = employee.employeeType || 'Office';

        // ── Office Employee: Location Validation ──
        if (attendance.employeeType === 'Office') {
            if (latitude === undefined || longitude === undefined) {
                return sendError(res, 400, 'GPS location is required for office attendance. Please enable location services.');
            }

            // Find assigned office or fallback to first active office
            const officeLocations = settings?.organization?.officeLocations || [];
            let assignedOffice = null;

            if (employee.assignedOfficeLocationId) {
                assignedOffice = officeLocations.find(
                    o => String(o._id) === String(employee.assignedOfficeLocationId) && o.isActive !== false
                );
            }

            // Fallback: find nearest active office with GPS configured
            if (!assignedOffice) {
                const activeOffices = officeLocations.filter(
                    o => o.latitude && o.longitude && o.isActive !== false
                );
                if (activeOffices.length === 0) {
                    return sendError(res, 403, 'No office locations are configured for GPS attendance. Please contact HR.');
                } else {
                    // Find nearest
                    let minDist = Infinity;
                    for (const office of activeOffices) {
                        const dist = haversineDistance(latitude, longitude, office.latitude, office.longitude);
                        if (dist < minDist) {
                            minDist = dist;
                            assignedOffice = office;
                        }
                    }
                }
            }

            if (assignedOffice && assignedOffice.latitude && assignedOffice.longitude) {
                const distance = haversineDistance(
                    latitude, longitude,
                    assignedOffice.latitude, assignedOffice.longitude
                );
                const allowedRadius = assignedOffice.radiusMeters || 200;

                attendance.locationValidation = {
                    isValid: distance <= allowedRadius,
                    officeLocationId: assignedOffice._id,
                    officeName: assignedOffice.name,
                    distanceFromOffice: Math.round(distance)
                };

                if (distance > allowedRadius) {
                    return sendError(res, 403,
                        `You are ${Math.round(distance)}m away from ${assignedOffice.name}. ` +
                        `Attendance is only allowed within ${allowedRadius}m of your office location.`
                    );
                }
            } else {
                return sendError(res, 403, 'Assigned office location lacks GPS coordinates. Please contact HR.');
            }
        }

        // Build location object
        let address = null;
        if (latitude !== undefined && longitude !== undefined) {
            address = await reverseGeocode(latitude, longitude);
        }

        attendance.checkInLocation = {
            address: address || '',
            coordinates: (latitude !== undefined && longitude !== undefined)
                ? { latitude, longitude }
                : undefined,
            accuracy: accuracy || null,
            timestamp: new Date()
        };

        attendance.checkInTime = new Date();
        attendance.status = 'Present';

        await attendance.save();

        // ── Field Employee: Initialize tracking document ──
        if (attendance.employeeType === 'Field' && trackingSettings.enableLiveTracking !== false) {
            const retentionDays = trackingSettings.locationRetentionDays || 90;
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + retentionDays);

            try {
                await HrmsLocationTrack.findOneAndUpdate(
                    { employeeId: employee._id, date: today },
                    {
                        $setOnInsert: {
                            attendanceId: attendance._id,
                            date: today,
                            points: [],
                            totalDistance: 0,
                            totalPoints: 0,
                            expiresAt
                        }
                    },
                    { upsert: true, new: true }
                );
            } catch (trackErr) {
                // Non-blocking: tracking init failure should not block check-in
                console.error('Location track init failed (non-blocking):', trackErr.message);
            }
        }

        return sendResponse(res, 200, 'Checked in successfully', attendance);
    } catch (error) {
        next(error);
    }
};

/**
 * EMPLOYEE: Check Out with GPS + route summary
 */
export const checkOut = async (req, res, next) => {
    try {
        const { latitude, longitude, accuracy } = req.body;

        const employee = await HrmsEmployee.findOne({ adminId: req.user.userId });
        if (!employee) return sendError(res, 404, 'Employee not found');

        const settings = await HrmsSettings.findOne().lean();
        const trackingSettings = settings?.trackingSettings || {};

        const today = getNormalizedDate();
        const attendance = await HrmsAttendance.findOne({ employeeId: employee._id, date: today });

        if (!attendance || !attendance.checkInTime) {
            return sendError(res, 400, 'No check-in found for today');
        }
        if (attendance.checkOutTime) {
            return sendError(res, 400, 'Already checked out today');
        }

        // GPS validation for coordinates if provided
        if (latitude !== undefined && longitude !== undefined) {
            if (!isValidCoordinate(latitude, longitude)) {
                return sendError(res, 400, 'Invalid GPS coordinates');
            }
            if (isSuspiciousMockLocation(accuracy, trackingSettings.allowMockLocation)) {
                return sendError(res, 403, 'Mock/spoofed location detected. Attendance rejected.');
            }
        }

        // ── Office Employee: Validate checkout location ──
        if (attendance.employeeType === 'Office') {
            if (latitude === undefined || longitude === undefined) {
                return sendError(res, 400, 'GPS location is required for office checkout. Please enable location services.');
            }

            const officeLocations = settings?.organization?.officeLocations || [];
            let assignedOffice = null;

            if (employee.assignedOfficeLocationId) {
                assignedOffice = officeLocations.find(
                    o => String(o._id) === String(employee.assignedOfficeLocationId) && o.isActive !== false
                );
            }

            if (!assignedOffice) {
                const activeOffices = officeLocations.filter(
                    o => o.latitude && o.longitude && o.isActive !== false
                );
                if (activeOffices.length === 0) {
                    return sendError(res, 403, 'No office locations are configured for GPS attendance. Please contact HR.');
                } else {
                    let minDist = Infinity;
                    for (const office of activeOffices) {
                        const dist = haversineDistance(latitude, longitude, office.latitude, office.longitude);
                        if (dist < minDist) {
                            minDist = dist;
                            assignedOffice = office;
                        }
                    }
                }
            }

            if (assignedOffice && assignedOffice.latitude && assignedOffice.longitude) {
                const distance = haversineDistance(
                    latitude, longitude,
                    assignedOffice.latitude, assignedOffice.longitude
                );
                const allowedRadius = assignedOffice.radiusMeters || 200;

                if (distance > allowedRadius) {
                    return sendError(res, 403,
                        `You are ${Math.round(distance)}m away from ${assignedOffice.name}. ` +
                        `Check-out is only allowed within ${allowedRadius}m of your office.`
                    );
                }
            } else {
                return sendError(res, 403, 'Assigned office location lacks GPS coordinates. Please contact HR.');
            }
        }

        // Build checkout location
        let address = null;
        if (latitude !== undefined && longitude !== undefined) {
            address = await reverseGeocode(latitude, longitude);
        }

        attendance.checkOutLocation = {
            address: address || '',
            coordinates: (latitude !== undefined && longitude !== undefined)
                ? { latitude, longitude }
                : undefined,
            accuracy: accuracy || null,
            timestamp: new Date()
        };

        attendance.checkOutTime = new Date();

        // Calculate working hours
        const diffMs = attendance.checkOutTime - attendance.checkInTime;
        const hours = diffMs / (1000 * 60 * 60);
        attendance.workingHours = Number(hours.toFixed(2));

        // Evaluate short hours against settings
        const minHours = settings?.workingHours?.minimumWorkingHours || 8;

        if (attendance.workingHours < minHours) {
            attendance.shortHours = Number((minHours - attendance.workingHours).toFixed(2));
        } else {
            attendance.shortHours = 0;
            if (attendance.workingHours > minHours) {
                attendance.overtimeHours = Number((attendance.workingHours - minHours).toFixed(2));
            }
        }

        // ── Field Employee: Finalize route distance from tracking data ──
        if (attendance.employeeType === 'Field') {
            try {
                const track = await HrmsLocationTrack.findOne({
                    employeeId: employee._id,
                    date: today
                }).lean();
                if (track) {
                    attendance.routeDistance = track.totalDistance || 0;
                    attendance.trackingPointsCount = track.totalPoints || 0;
                }
            } catch (trackErr) {
                console.error('Track summary fetch failed (non-blocking):', trackErr.message);
            }
        }

        await attendance.save();
        return sendResponse(res, 200, 'Checked out successfully', attendance);
    } catch (error) {
        next(error);
    }
};

export const requestRegularization = async (req, res, next) => {
    try {
        const { date, requestedCheckInTime, requestedCheckOutTime, reason } = req.body;
        const employee = await HrmsEmployee.findOne({ adminId: req.user.userId });
        if (!employee) return sendError(res, 404, 'Employee not found');

        if (!date || !requestedCheckInTime || !requestedCheckOutTime || !reason) {
            return sendError(res, 400, 'Date, check-in time, check-out time, and reason are required');
        }

        const normDate = getNormalizedDate(date);

        // Don't allow future date regularization
        if (normDate > getNormalizedDate()) {
            return sendError(res, 400, 'Cannot regularize attendance for a future date');
        }

        let attendance = await HrmsAttendance.findOne({ employeeId: employee._id, date: normDate });

        if (!attendance) {
            attendance = new HrmsAttendance({ employeeId: employee._id, date: normDate });
        }

        if (attendance.regularization?.isRequested) {
            if (attendance.regularization.status === 'Pending') {
                return sendError(res, 400, 'A regularization request is already pending for this date');
            } else if (attendance.regularization.status === 'Approved') {
                return sendError(res, 400, 'Regularization for this date has already been approved');
            }
        }

        attendance.regularization = {
            isRequested: true,
            requestedCheckInTime: new Date(requestedCheckInTime),
            requestedCheckOutTime: new Date(requestedCheckOutTime),
            reason,
            status: 'Pending'
        };

        await attendance.save();
        return sendResponse(res, 200, 'Regularization requested successfully', attendance);
    } catch (error) {
        next(error);
    }
};

/**
 * MANAGER/ADMIN: Approve regularization request
 */
export const approveRegularization = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { action, rejectionReason } = req.body; // 'Approved' or 'Rejected'

        const attendance = await HrmsAttendance.findById(id);
        if (!attendance) return sendError(res, 404, 'Attendance record not found');

        if (!attendance.regularization?.isRequested) {
            return sendError(res, 400, 'No regularization request found');
        }

        if (attendance.regularization.status !== 'Pending') {
            return sendError(res, 400, `Regularization is already ${attendance.regularization.status}`);
        }

        // Manager scope check — can only approve reporting employees
        if (req.user.role === 'HRMS_EMPLOYEE' && req.hrmsEmployee) {
            const targetEmployee = await HrmsEmployee.findById(attendance.employeeId).lean();
            if (!targetEmployee || String(targetEmployee.managerId) !== String(req.hrmsEmployee._id)) {
                return sendError(res, 403, 'You can only approve regularization for your team members');
            }
            // Prevent self-approval
            if (String(attendance.employeeId) === String(req.hrmsEmployee._id)) {
                return sendError(res, 403, 'You cannot approve your own regularization request');
            }
        }

        const approverEmployee = await HrmsEmployee.findOne({ adminId: req.user.userId });

        if (action === 'Approved') {
            attendance.regularization.status = 'Approved';
            attendance.regularization.approvedBy = approverEmployee?._id;

            // Apply the regularized times
            attendance.checkInTime = attendance.regularization.requestedCheckInTime;
            attendance.checkOutTime = attendance.regularization.requestedCheckOutTime;
            attendance.status = 'Present';

            // Recalculate working hours
            const diffMs = attendance.checkOutTime - attendance.checkInTime;
            const hours = diffMs / (1000 * 60 * 60);
            attendance.workingHours = Number(hours.toFixed(2));

            const settings = await HrmsSettings.findOne().lean();
            const minHours = settings?.workingHours?.minimumWorkingHours || 8;
            attendance.shortHours = attendance.workingHours < minHours
                ? Number((minHours - attendance.workingHours).toFixed(2))
                : 0;
            attendance.overtimeHours = attendance.workingHours > minHours
                ? Number((attendance.workingHours - minHours).toFixed(2))
                : 0;
        } else {
            attendance.regularization.status = 'Rejected';
            attendance.regularization.rejectionReason = rejectionReason || '';
            attendance.regularization.approvedBy = approverEmployee?._id;
        }

        await attendance.save();
        return sendResponse(res, 200, `Regularization ${action.toLowerCase()}`, attendance);
    } catch (error) {
        next(error);
    }
};

/**
 * EMPLOYEE: Get own attendance records
 */
export const getMyAttendance = async (req, res, next) => {
    try {
        const employee = await HrmsEmployee.findOne({ adminId: req.user.userId });
        if (!employee) return sendError(res, 404, 'Employee not found');

        const { month, year } = req.query;
        const filter = { employeeId: employee._id };

        if (month && year) {
            const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
            filter.date = { $gte: startDate, $lte: endDate };
        }

        const records = await HrmsAttendance.find(filter).sort({ date: -1 }).lean();
        return sendResponse(res, 200, 'Attendance retrieved', records);
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN: Get all attendance records with filters
 */
export const getAllAttendance = async (req, res, next) => {
    try {
        const { page = 1, limit = 50, date, month, year, employeeId, employeeType } = req.query;
        const filter = {};

        if (employeeId) filter.employeeId = employeeId;
        if (employeeType) filter.employeeType = employeeType;

        if (date) {
            filter.date = getNormalizedDate(date);
        } else if (month && year) {
            const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
            filter.date = { $gte: startDate, $lte: endDate };
        }

        // If manager, scope to team only
        if (req.user.role === 'HRMS_EMPLOYEE' && req.hrmsEmployee) {
            const teamIds = await HrmsEmployee.find({ managerId: req.hrmsEmployee._id })
                .select('_id').lean();
            const allowedIds = teamIds.map(t => t._id);
            if (filter.employeeId) {
                if (!allowedIds.some(id => String(id) === String(filter.employeeId))) {
                    return sendResponse(res, 200, 'All attendance retrieved', {
                        records: [],
                        pagination: { page: 1, limit: parseInt(limit), total: 0, totalPages: 0 }
                    });
                }
            } else {
                filter.employeeId = { $in: allowedIds };
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [records, total] = await Promise.all([
            HrmsAttendance.find(filter)
                .populate({
                    path: 'employeeId',
                    populate: { path: 'adminId', select: 'name email phone' }
                })
                .sort({ date: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            HrmsAttendance.countDocuments(filter)
        ]);

        return sendResponse(res, 200, 'All attendance retrieved', {
            records,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN/MANAGER: Get pending regularization requests
 */
export const getPendingRegularizations = async (req, res, next) => {
    try {
        const filter = { 'regularization.isRequested': true, 'regularization.status': 'Pending' };

        // If manager, scope to team only
        if (req.user.role === 'HRMS_EMPLOYEE' && req.hrmsEmployee) {
            const teamIds = await HrmsEmployee.find({ managerId: req.hrmsEmployee._id })
                .select('_id').lean();
            filter.employeeId = { $in: teamIds.map(t => t._id) };
        }

        const records = await HrmsAttendance.find(filter)
            .populate({
                path: 'employeeId',
                populate: { path: 'adminId', select: 'name email' }
            })
            .sort({ createdAt: -1 })
            .lean();

        return sendResponse(res, 200, 'Pending regularizations retrieved', records);
    } catch (error) {
        next(error);
    }
};
