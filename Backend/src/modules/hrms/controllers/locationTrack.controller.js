import { HrmsLocationTrack } from '../models/locationTrack.model.js';
import { HrmsAttendance } from '../models/attendance.model.js';
import { HrmsEmployee } from '../models/employee.model.js';
import { HrmsSettings } from '../models/settings.model.js';
import { sendResponse, sendError } from '../../../utils/response.js';
import { isValidCoordinate, haversineDistance, calculateRouteDistance } from '../services/geoUtils.js';

/**
 * EMPLOYEE: Batch-save location tracking points.
 * Called periodically by the frontend location tracker hook.
 * Optimized: batch append via $push, recalculate totals.
 */
export const saveLocationPoints = async (req, res, next) => {
    try {
        const { points } = req.body;

        if (!points || !Array.isArray(points) || points.length === 0) {
            return sendError(res, 400, 'At least one location point is required');
        }

        // Validate all points
        const validPoints = [];
        for (const p of points) {
            if (!isValidCoordinate(p.latitude, p.longitude)) continue;
            validPoints.push({
                latitude: p.latitude,
                longitude: p.longitude,
                accuracy: p.accuracy || null,
                speed: p.speed || null,
                timestamp: p.timestamp ? new Date(p.timestamp) : new Date()
            });
        }

        if (validPoints.length === 0) {
            return sendError(res, 400, 'No valid location points found');
        }

        const employee = await HrmsEmployee.findOne({ adminId: req.user.userId }).lean();
        if (!employee) return sendError(res, 404, 'Employee not found');

        if (employee.employeeType !== 'Field') {
            return sendError(res, 403, 'Location tracking is only available for field employees');
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check active attendance
        const attendance = await HrmsAttendance.findOne({
            employeeId: employee._id,
            date: today,
            checkInTime: { $exists: true },
            checkOutTime: { $exists: false }
        }).lean();

        if (!attendance) {
            return sendError(res, 400, 'No active check-in found. Please check in first.');
        }

        // Get settings for retention
        const settings = await HrmsSettings.findOne().lean();
        const retentionDays = settings?.trackingSettings?.locationRetentionDays || 90;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + retentionDays);

        // Batch append points and update totals atomically
        const track = await HrmsLocationTrack.findOneAndUpdate(
            { employeeId: employee._id, date: today },
            {
                $push: { points: { $each: validPoints } },
                $inc: { totalPoints: validPoints.length },
                $setOnInsert: {
                    attendanceId: attendance._id,
                    date: today,
                    expiresAt
                }
            },
            { upsert: true, new: true }
        );

        // Recalculate total distance from all points
        if (track.points && track.points.length >= 2) {
            const totalDistance = calculateRouteDistance(track.points);
            await HrmsLocationTrack.updateOne(
                { _id: track._id },
                { $set: { totalDistance } }
            );

            // Update attendance summary (non-blocking)
            HrmsAttendance.updateOne(
                { _id: attendance._id },
                { $set: { routeDistance: totalDistance, trackingPointsCount: track.totalPoints } }
            ).catch(err => console.error('Attendance route update failed:', err.message));
        }

        return sendResponse(res, 200, 'Location points saved', {
            pointsSaved: validPoints.length,
            totalPoints: track.totalPoints,
            totalDistance: track.totalDistance
        });
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN/MANAGER: Get live locations for all active field employees.
 * Returns the latest GPS point for each checked-in field employee.
 */
export const getLiveLocations = async (req, res, next) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Scope: manager sees only their team
        let employeeFilter = { employeeType: 'Field', status: 'Active' };
        if (req.user.role === 'HRMS_EMPLOYEE' && req.hrmsEmployee) {
            const teamIds = await HrmsEmployee.find({ managerId: req.hrmsEmployee._id })
                .select('_id').lean();
            employeeFilter._id = { $in: teamIds.map(t => t._id) };
        }

        const fieldEmployees = await HrmsEmployee.find(employeeFilter)
            .populate('adminId', 'name email phone')
            .lean();

        if (fieldEmployees.length === 0) {
            return sendResponse(res, 200, 'No active field employees', []);
        }

        const employeeIds = fieldEmployees.map(e => e._id);

        // Get today's attendance for these employees (only checked-in, not checked-out)
        const activeAttendances = await HrmsAttendance.find({
            employeeId: { $in: employeeIds },
            date: today,
            checkInTime: { $exists: true }
        }).lean();

        const attendanceMap = {};
        for (const att of activeAttendances) {
            attendanceMap[String(att.employeeId)] = att;
        }

        // Get today's tracks
        const tracks = await HrmsLocationTrack.find({
            employeeId: { $in: employeeIds },
            date: today
        }).lean();

        const trackMap = {};
        for (const t of tracks) {
            trackMap[String(t.employeeId)] = t;
        }

        // Build live location data
        const liveData = fieldEmployees.map(emp => {
            const att = attendanceMap[String(emp._id)];
            const track = trackMap[String(emp._id)];
            const lastPoint = track?.points?.length > 0
                ? track.points[track.points.length - 1]
                : null;

            return {
                employee: {
                    _id: emp._id,
                    employeeId: emp.employeeId,
                    name: emp.adminId?.name || '',
                    email: emp.adminId?.email || '',
                    phone: emp.adminId?.phone || '',
                    department: emp.department || '',
                    designation: emp.designation || '',
                    employeeType: emp.employeeType
                },
                attendance: att ? {
                    checkInTime: att.checkInTime,
                    checkOutTime: att.checkOutTime,
                    checkInLocation: att.checkInLocation,
                    checkOutLocation: att.checkOutLocation,
                    status: att.checkOutTime ? 'Checked Out' : 'Active'
                } : null,
                tracking: {
                    currentLocation: lastPoint ? {
                        latitude: lastPoint.latitude,
                        longitude: lastPoint.longitude,
                        accuracy: lastPoint.accuracy,
                        lastUpdated: lastPoint.timestamp
                    } : null,
                    totalDistance: track?.totalDistance || 0,
                    totalPoints: track?.totalPoints || 0,
                    isTracking: att && !att.checkOutTime && lastPoint != null
                }
            };
        }).filter(d => d.attendance != null); // Only show employees who checked in today

        return sendResponse(res, 200, 'Live locations retrieved', liveData);
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN/MANAGER: Get full route track for a specific employee on a specific date.
 */
export const getEmployeeTrack = async (req, res, next) => {
    try {
        const { employeeId, date } = req.params;

        const employee = await HrmsEmployee.findById(employeeId)
            .populate('adminId', 'name email phone')
            .lean();
        if (!employee) return sendError(res, 404, 'Employee not found');

        // Manager scope check
        if (req.user.role === 'HRMS_EMPLOYEE' && req.hrmsEmployee) {
            if (String(employee.managerId) !== String(req.hrmsEmployee._id)) {
                return sendError(res, 403, 'You can only view tracks for your team members');
            }
        }

        const normDate = new Date(date);
        normDate.setHours(0, 0, 0, 0);

        const track = await HrmsLocationTrack.findOne({
            employeeId,
            date: normDate
        }).lean();

        const attendance = await HrmsAttendance.findOne({
            employeeId,
            date: normDate
        }).lean();

        return sendResponse(res, 200, 'Employee track retrieved', {
            employee: {
                _id: employee._id,
                employeeId: employee.employeeId,
                name: employee.adminId?.name || '',
                department: employee.department,
                designation: employee.designation,
                employeeType: employee.employeeType
            },
            attendance: attendance || null,
            track: track || null
        });
    } catch (error) {
        next(error);
    }
};

/**
 * EMPLOYEE: Get own location history for a specific date.
 */
export const getMyTrack = async (req, res, next) => {
    try {
        const { date } = req.params;
        const employee = await HrmsEmployee.findOne({ adminId: req.user.userId }).lean();
        if (!employee) return sendError(res, 404, 'Employee not found');

        const normDate = new Date(date);
        normDate.setHours(0, 0, 0, 0);

        const track = await HrmsLocationTrack.findOne({
            employeeId: employee._id,
            date: normDate
        }).lean();

        return sendResponse(res, 200, 'Track retrieved', track);
    } catch (error) {
        next(error);
    }
};
