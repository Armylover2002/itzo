import mongoose from 'mongoose';
import { HrmsDailyReport } from '../models/dailyReport.model.js';
import { HrmsDailyReportSettings } from '../models/dailyReportSettings.model.js';
import { HrmsDailyReportComment } from '../models/dailyReportComment.model.js';
import { HrmsEmployee } from '../models/employee.model.js';
import { sendResponse, sendError } from '../../../utils/response.js';

// ==========================================
// SHARED / UTILS
// ==========================================

export const getSettings = async (req, res, next) => {
    try {
        let settings = await HrmsDailyReportSettings.findOne().lean();
        if (!settings) {
            settings = await HrmsDailyReportSettings.create({});
        }
        return sendResponse(res, 200, 'Settings retrieved successfully', settings);
    } catch (error) {
        next(error);
    }
};

const validateReportDate = (dateString) => {
    if (!dateString) return null;
    // Parse YYYY-MM-DD string parts directly to avoid timezone conversion issues.
    // Indian users (IST = UTC+5:30) sending '2026-07-01' should always get July 1 at UTC midnight,
    // not June 30 due to timezone offset when using new Date() with timezone.
    const parts = String(dateString).split('T')[0].split('-');
    if (parts.length !== 3) return null;
    const d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0));
    if (isNaN(d.getTime())) return null;
    return d;
};

// ==========================================
// EMPLOYEE ENDPOINTS
// ==========================================

export const createOrUpdateReport = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const employee = await HrmsEmployee.findOne({ adminId: req.user.userId }).session(session);
        if (!employee) {
            await session.abortTransaction();
            return sendError(res, 404, 'Employee profile not found');
        }

        const { _id, reportDate, tasks, workSummary, metrics, travelSummary, problemsFaced, achievements, pendingWork, tomorrowPlan, remarks, attachments, status } = req.body;
        
        let targetDate = validateReportDate(reportDate);
        if (!targetDate) {
            await session.abortTransaction();
            return sendError(res, 400, 'Invalid report date');
        }

        let report;
        
        if (_id) {
            report = await HrmsDailyReport.findById(_id).session(session);
            if (!report || report.employeeId.toString() !== employee._id.toString()) {
                await session.abortTransaction();
                return sendError(res, 404, 'Report not found or unauthorized');
            }
            if (report.status !== 'Draft' && report.status !== 'Revision Requested') {
                await session.abortTransaction();
                return sendError(res, 400, 'Cannot edit a submitted report unless a revision is requested');
            }
        } else {
            // Check for duplicate date
            const existing = await HrmsDailyReport.findOne({ employeeId: employee._id, reportDate: targetDate }).session(session);
            if (existing) {
                await session.abortTransaction();
                return sendError(res, 400, 'A report for this date already exists. Please edit the existing report.');
            }
            report = new HrmsDailyReport({
                employeeId: employee._id,
                reportDate: targetDate,
                managerId: employee.managerId || null
            });
        }

        // Update fields
        report.tasks = tasks || [];
        report.workSummary = workSummary || '';
        report.problemsFaced = problemsFaced || '';
        report.achievements = achievements || '';
        report.pendingWork = pendingWork || '';
        report.tomorrowPlan = tomorrowPlan || '';
        report.remarks = remarks || '';
        if (attachments) report.attachments = attachments;

        // Metrics — auto-calculate restaurantsVisited count from names array
        if (metrics) {
            const names = Array.isArray(metrics.restaurantsVisitedNames)
                ? metrics.restaurantsVisitedNames.filter(n => typeof n === 'string' && n.trim())
                : [];
            report.metrics = {
                ...metrics,
                restaurantsVisited: names.length,
                restaurantsVisitedNames: names.map(n => n.trim())
            };
        } else {
            report.metrics = {};
        }

        // Preserve travelSummary from existing reports for backward compatibility (read-only)
        // New reports will not have travelSummary data
        if (travelSummary && report.travelSummary) {
            report.travelSummary = travelSummary;
        }

        const finalStatus = status === 'Submitted' ? 'Submitted' : 'Draft';
        report.status = finalStatus;

        await report.save({ session });
        await session.commitTransaction();
        
        return sendResponse(res, _id ? 200 : 201, `Report ${finalStatus === 'Submitted' ? 'submitted' : 'saved'} successfully`, report);

    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

export const getMyReports = async (req, res, next) => {
    try {
        const employee = await HrmsEmployee.findOne({ adminId: req.user.userId });
        if (!employee) return sendError(res, 404, 'Employee not found');

        const { page = 1, limit = 15, status, fromDate, toDate } = req.query;
        const filter = { employeeId: employee._id };
        
        if (status && status !== 'All') filter.status = status;
        if (fromDate || toDate) {
            filter.reportDate = {};
            if (fromDate) filter.reportDate.$gte = new Date(fromDate);
            if (toDate) filter.reportDate.$lte = new Date(toDate);
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [reports, total] = await Promise.all([
            HrmsDailyReport.find(filter)
                .sort({ reportDate: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate({ path: 'managerId', populate: { path: 'adminId', select: 'name' } })
                .lean(),
            HrmsDailyReport.countDocuments(filter)
        ]);

        return sendResponse(res, 200, 'Reports retrieved successfully', {
            reports,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (error) {
        next(error);
    }
};

export const getReportDetails = async (req, res, next) => {
    try {
        const { id } = req.params;
        const report = await HrmsDailyReport.findById(id)
            .populate({ path: 'employeeId', populate: { path: 'adminId', select: 'name email profileImage' } })
            .populate({ path: 'managerId', populate: { path: 'adminId', select: 'name' } })
            .populate('reviewedBy', 'name')
            .lean();

        if (!report) return sendError(res, 404, 'Report not found');

        // RBAC Check
        if (req.user.role === 'HRMS_EMPLOYEE') {
            const employee = await HrmsEmployee.findOne({ adminId: req.user.userId });
            const isOwner = employee && report.employeeId._id.toString() === employee._id.toString();
            const isManager = employee && report.managerId && report.managerId._id.toString() === employee._id.toString();
            
            if (!isOwner && !isManager) {
                return sendError(res, 403, 'Not authorized to view this report');
            }
        }

        const comments = await HrmsDailyReportComment.find({ reportId: id }).sort({ createdAt: 1 }).lean();

        // Map Admin details to comments if sender is Admin
        for (let comment of comments) {
            if (comment.senderType === 'Admin') {
                // To display Admin names accurately
                // You could populate it, but since it references FoodAdmin directly, we'll need a manual lookup or populate
                // Not strictly necessary if we just display 'Admin'
            }
        }

        return sendResponse(res, 200, 'Report details retrieved', { report, comments });
    } catch (error) {
        next(error);
    }
};

export const replyToReport = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { message, attachments } = req.body;

        if (!message && (!attachments || attachments.length === 0)) return sendError(res, 400, 'Message or attachments are required');

        const report = await HrmsDailyReport.findById(id);
        if (!report) return sendError(res, 404, 'Report not found');

        let senderType = 'Admin';
        let senderId = req.user.userId;

        if (req.user.role === 'HRMS_EMPLOYEE') {
            const employee = await HrmsEmployee.findOne({ adminId: req.user.userId });
            const isOwner = employee && report.employeeId.toString() === employee._id.toString();
            const isManager = employee && report.managerId && report.managerId.toString() === employee._id.toString();
            
            if (!isOwner && !isManager) {
                return sendError(res, 403, 'Not authorized to reply to this report');
            }

            senderType = isOwner ? 'Employee' : 'Manager';
            senderId = employee._id;
        }

        const comment = new HrmsDailyReportComment({
            reportId: report._id,
            senderType,
            senderId,
            message,
            attachments: attachments || []
        });

        await comment.save();

        return sendResponse(res, 201, 'Comment added successfully', comment);
    } catch (error) {
        next(error);
    }
};

// ==========================================
// ADMIN / MANAGER ENDPOINTS
// ==========================================

export const getAllReports = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, status, department, managerId, search, date } = req.query;
        let filter = {};
        
        // Filter out Drafts for Managers/Admins (unless they are specifically viewing it, but usually managers don't see drafts)
        filter.status = { $ne: 'Draft' };
        
        if (status && status !== 'All') filter.status = status;
        if (date) {
            const d = new Date(date);
            if (!isNaN(d)) {
                d.setUTCHours(0,0,0,0);
                filter.reportDate = d;
            }
        }

        // If it's a manager (not Admin), restrict to their team
        if (req.user.role === 'HRMS_EMPLOYEE') {
            const manager = await HrmsEmployee.findOne({ adminId: req.user.userId });
            if (!manager) return sendError(res, 403, 'Manager profile not found');
            filter.managerId = manager._id;
        } else if (managerId && managerId !== 'All') {
            filter.managerId = managerId;
        }

        // Employee filter: lookup by department and/or admin name
        if ((department && department !== 'All') || search) {
            let empFilter = {};
            if (department && department !== 'All') {
                empFilter.department = department;
            }

            // If searching by name, find matching FoodAdmin IDs first
            if (search) {
                const { FoodAdmin } = await import('../../../core/admin/admin.model.js');
                const matchingAdmins = await FoodAdmin.find(
                    { name: { $regex: search, $options: 'i' } },
                    { _id: 1 }
                ).lean();
                const adminIds = matchingAdmins.map(a => a._id);
                empFilter.adminId = { $in: adminIds };
            }

            const matchingEmployees = await HrmsEmployee.find(empFilter, { _id: 1 }).lean();
            const empIds = matchingEmployees.map(e => e._id);
            filter.employeeId = { $in: empIds };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [reports, total] = await Promise.all([
            HrmsDailyReport.find(filter)
                .sort({ reportDate: -1, createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate({ path: 'employeeId', populate: { path: 'adminId', select: 'name email profileImage' } })
                .populate({ path: 'managerId', populate: { path: 'adminId', select: 'name' } })
                .lean(),
            HrmsDailyReport.countDocuments(filter)
        ]);

        return sendResponse(res, 200, 'Reports retrieved', {
            reports,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (error) {
        next(error);
    }
};

export const updateReportStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, remarks } = req.body;

        const allowedStatuses = ['Approved', 'Rejected', 'Revision Requested', 'Under Review'];
        if (!allowedStatuses.includes(status)) {
            return sendError(res, 400, 'Invalid status');
        }

        const report = await HrmsDailyReport.findById(id);
        if (!report) return sendError(res, 404, 'Report not found');
        if (report.status === 'Draft') return sendError(res, 400, 'Cannot review a drafted report');

        // RBAC Validation
        if (req.user.role === 'HRMS_EMPLOYEE') {
            const manager = await HrmsEmployee.findOne({ adminId: req.user.userId });
            if (!manager || !report.managerId || report.managerId.toString() !== manager._id.toString()) {
                return sendError(res, 403, 'Not authorized to review this report');
            }
        }

        report.status = status;
        report.reviewedBy = req.user.userId;
        report.reviewDate = new Date();

        if (remarks) {
            // Also add a comment automatically
            const senderType = req.user.role === 'HRMS_EMPLOYEE' ? 'Manager' : 'Admin';
            const senderId = req.user.role === 'HRMS_EMPLOYEE' ? (await HrmsEmployee.findOne({adminId: req.user.userId}))._id : req.user.userId;
            
            const comment = new HrmsDailyReportComment({
                reportId: report._id,
                senderType,
                senderId,
                message: remarks
            });
            await comment.save();
        }

        await report.save();
        return sendResponse(res, 200, 'Report status updated successfully', report);
    } catch (error) {
        next(error);
    }
};

export const updateSettings = async (req, res, next) => {
    try {
        const updates = req.body;
        let settings = await HrmsDailyReportSettings.findOne();
        if (!settings) {
            settings = new HrmsDailyReportSettings({});
        }

        Object.assign(settings, updates);
        settings.updatedBy = req.user.userId;

        await settings.save();
        return sendResponse(res, 200, 'Settings updated successfully', settings);
    } catch (error) {
        next(error);
    }
};

export const getAdminDashboardStats = async (req, res, next) => {
    try {
        const today = new Date();
        today.setUTCHours(0,0,0,0);

        let filter = { status: { $ne: 'Draft' } };
        
        // If manager, scope to team
        if (req.user.role === 'HRMS_EMPLOYEE') {
            const manager = await HrmsEmployee.findOne({ adminId: req.user.userId });
            if (manager) filter.managerId = manager._id;
        }

        const [totalSubmitted, pending, approved, rejected, todaySubmitted] = await Promise.all([
            HrmsDailyReport.countDocuments(filter),
            HrmsDailyReport.countDocuments({ ...filter, status: { $in: ['Submitted', 'Under Review'] } }),
            HrmsDailyReport.countDocuments({ ...filter, status: 'Approved' }),
            HrmsDailyReport.countDocuments({ ...filter, status: 'Rejected' }),
            HrmsDailyReport.countDocuments({ ...filter, reportDate: today })
        ]);

        return sendResponse(res, 200, 'Stats retrieved', {
            totalSubmitted,
            pending,
            approved,
            rejected,
            todaySubmitted
        });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// RESTAURANT SEARCH & REPORT PENDING CHECK
// ==========================================

/**
 * EMPLOYEE: Search restaurants for dropdown (system + allows free-form)
 */
export const searchRestaurants = async (req, res, next) => {
    try {
        const { q } = req.query;
        if (!q || q.trim().length < 2) {
            return sendResponse(res, 200, 'Provide at least 2 characters to search', { restaurants: [] });
        }

        // Dynamically import FoodRestaurant to avoid tight coupling
        const { FoodRestaurant } = await import('../../food/restaurant/models/restaurant.model.js');

        const regex = new RegExp(q.trim(), 'i');
        const restaurants = await FoodRestaurant.find(
            { restaurantName: regex },
            { restaurantName: 1, restaurantId: 1, city: 1 }
        )
            .limit(15)
            .lean();

        return sendResponse(res, 200, 'Restaurants retrieved', {
            restaurants: restaurants.map(r => ({
                _id: r._id,
                name: r.restaurantName,
                id: r.restaurantId,
                city: r.city || ''
            }))
        });
    } catch (error) {
        // If FoodRestaurant model doesn't exist or import fails, return empty
        if (error.code === 'MODULE_NOT_FOUND' || error.message?.includes('Cannot find module')) {
            return sendResponse(res, 200, 'Restaurant search not available', { restaurants: [] });
        }
        next(error);
    }
};

/**
 * EMPLOYEE: Check if today's daily report is submitted (for checkout popup)
 */
export const checkPendingReport = async (req, res, next) => {
    try {
        const employee = await HrmsEmployee.findOne({ adminId: req.user.userId });
        if (!employee) return sendError(res, 404, 'Employee not found');

        // Build today's date at midnight UTC
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        const report = await HrmsDailyReport.findOne({
            employeeId: employee._id,
            reportDate: today,
            status: { $in: ['Submitted', 'Under Review', 'Approved'] }
        }).lean();

        return sendResponse(res, 200, 'Pending report check', {
            hasPendingReport: !report,
            date: today.toISOString().split('T')[0],
            reportExists: !!report,
            reportStatus: report?.status || null
        });
    } catch (error) {
        next(error);
    }
};
