import { HrmsSupportSettings } from '../models/supportSettings.model.js';
import { HrmsSupportTicket } from '../models/supportTicket.model.js';
import { HrmsSupportMessage } from '../models/supportMessage.model.js';
import { getNextSequence } from '../models/counter.model.js';
import { HrmsEmployee } from '../models/employee.model.js';
import { sendResponse, sendError } from '../../../utils/response.js';

/**
 * ----------------------------------------
 * SHARED & HELPER METHODS
 * ----------------------------------------
 */
export const getSettings = async (req, res, next) => {
    try {
        let settings = await HrmsSupportSettings.findOne().lean();
        if (!settings) {
            settings = await HrmsSupportSettings.create({});
        }
        return sendResponse(res, 200, 'Support settings retrieved', settings);
    } catch (error) {
        next(error);
    }
};

/**
 * ----------------------------------------
 * EMPLOYEE ENDPOINTS
 * ----------------------------------------
 */
export const createTicket = async (req, res, next) => {
    try {
        const employee = await HrmsEmployee.findOne({ adminId: req.user.userId });
        if (!employee) return sendError(res, 404, 'Employee not found');

        const { subject, category, priority, description, attachments } = req.body;
        if (!subject || !category || !description) {
            return sendError(res, 400, 'Subject, category, and description are required');
        }

        const seq = await getNextSequence('supportTicketId');
        const year = new Date().getFullYear();
        const ticketId = `SUP-${year}-${String(seq).padStart(6, '0')}`;

        let settings = await HrmsSupportSettings.findOne().lean();
        if (!settings) settings = await HrmsSupportSettings.create({});

        const ticket = new HrmsSupportTicket({
            ticketId,
            employeeId: employee._id,
            subject,
            category,
            priority: priority || 'Medium',
            status: settings.ticketConfig?.defaultStatus || 'Open',
            unreadByAdmin: true,
            unreadByEmployee: false
        });

        await ticket.save();

        const message = new HrmsSupportMessage({
            ticketId: ticket._id,
            senderType: 'Employee',
            senderId: employee._id,
            message: description,
            attachments: attachments || []
        });

        await message.save();

        // Check for auto-reply
        if (settings.ticketConfig?.autoReplyMessage) {
            const autoReply = new HrmsSupportMessage({
                ticketId: ticket._id,
                senderType: 'Admin',
                senderId: employee._id, // Use employee ObjectId to satisfy required schema; frontend renders by senderType not senderId
                message: settings.ticketConfig.autoReplyMessage,
                attachments: []
            });
            await autoReply.save();
            // Update ticket to unread by employee since admin auto-replied
            ticket.unreadByEmployee = true;
            await ticket.save();
        }

        return sendResponse(res, 201, 'Support ticket created successfully', ticket);
    } catch (error) {
        next(error);
    }
};

export const getEmployeeTickets = async (req, res, next) => {
    try {
        const employee = await HrmsEmployee.findOne({ adminId: req.user.userId });
        if (!employee) return sendError(res, 404, 'Employee not found');

        const { page = 1, limit = 20, status } = req.query;
        const filter = { employeeId: employee._id };
        if (status && status !== 'All') filter.status = status;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [tickets, total] = await Promise.all([
            HrmsSupportTicket.find(filter)
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('assignedAdminId', 'name')
                .lean(),
            HrmsSupportTicket.countDocuments(filter)
        ]);

        return sendResponse(res, 200, 'Tickets retrieved', {
            tickets,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (error) {
        next(error);
    }
};

export const getTicketDetails = async (req, res, next) => {
    try {
        const { id } = req.params;
        const ticket = await HrmsSupportTicket.findById(id)
            .populate({ path: 'employeeId', populate: { path: 'adminId', select: 'name email phone profileImage' } })
            .populate('assignedAdminId', 'name email')
            .lean();

        if (!ticket) return sendError(res, 404, 'Ticket not found');

        // Check authorization
        if (req.user.role === 'HRMS_EMPLOYEE') {
            const employee = await HrmsEmployee.findOne({ adminId: req.user.userId });
            if (!employee || ticket.employeeId._id.toString() !== employee._id.toString()) {
                return sendError(res, 403, 'Not authorized to view this ticket');
            }
            // Mark as read by employee
            await HrmsSupportTicket.findByIdAndUpdate(id, { unreadByEmployee: false });
        } else {
            // Mark as read by admin
            await HrmsSupportTicket.findByIdAndUpdate(id, { unreadByAdmin: false });
        }

        const messages = await HrmsSupportMessage.find({ ticketId: id })
            .sort({ createdAt: 1 })
            .lean();

        return sendResponse(res, 200, 'Ticket details retrieved', { ticket, messages });
    } catch (error) {
        next(error);
    }
};

export const replyToTicket = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { message, attachments } = req.body;

        if (!message && (!attachments || attachments.length === 0)) {
            return sendError(res, 400, 'Message or attachments are required');
        }

        const ticket = await HrmsSupportTicket.findById(id);
        if (!ticket) return sendError(res, 404, 'Ticket not found');
        if (ticket.status === 'Closed') return sendError(res, 400, 'Cannot reply to a closed ticket');

        let senderType = 'Employee';
        let senderId = null;

        if (req.user.role === 'HRMS_EMPLOYEE') {
            const employee = await HrmsEmployee.findOne({ adminId: req.user.userId });
            if (!employee || ticket.employeeId.toString() !== employee._id.toString()) {
                return sendError(res, 403, 'Not authorized to reply to this ticket');
            }
            senderId = employee._id;
            ticket.unreadByAdmin = true;
            if (ticket.status === 'Waiting for Employee') {
                ticket.status = 'Open';
            }
        } else {
            senderType = 'Admin';
            senderId = req.user.userId;
            ticket.unreadByEmployee = true;
            if (ticket.status === 'Open') {
                ticket.status = 'In Progress';
            }
        }

        const newMessage = new HrmsSupportMessage({
            ticketId: ticket._id,
            senderType,
            senderId,
            message,
            attachments: attachments || []
        });

        await newMessage.save();
        await ticket.save(); // update timestamps and unread status

        return sendResponse(res, 201, 'Reply sent successfully', newMessage);
    } catch (error) {
        next(error);
    }
};

export const getEmployeeUnreadCount = async (req, res, next) => {
    try {
        const employee = await HrmsEmployee.findOne({ adminId: req.user.userId });
        if (!employee) return sendError(res, 404, 'Employee not found');

        const count = await HrmsSupportTicket.countDocuments({ employeeId: employee._id, unreadByEmployee: true });
        return sendResponse(res, 200, 'Unread count retrieved', { count });
    } catch (error) {
        next(error);
    }
};

/**
 * ----------------------------------------
 * ADMIN ENDPOINTS
 * ----------------------------------------
 */
export const updateSettings = async (req, res, next) => {
    try {
        const updates = req.body;
        let settings = await HrmsSupportSettings.findOne();
        if (!settings) settings = new HrmsSupportSettings({});

        if (updates.hrContact) settings.hrContact = updates.hrContact;
        if (updates.ticketConfig) settings.ticketConfig = updates.ticketConfig;
        settings.updatedBy = req.user.userId;

        await settings.save();
        return sendResponse(res, 200, 'Settings updated successfully', settings);
    } catch (error) {
        next(error);
    }
};

export const getAdminDashboardStats = async (req, res, next) => {
    try {
        const [total, open, pending, inProgress, resolved, closed, highPriority] = await Promise.all([
            HrmsSupportTicket.countDocuments(),
            HrmsSupportTicket.countDocuments({ status: 'Open' }),
            HrmsSupportTicket.countDocuments({ status: 'Waiting for Employee' }),
            HrmsSupportTicket.countDocuments({ status: 'In Progress' }),
            HrmsSupportTicket.countDocuments({ status: 'Resolved' }),
            HrmsSupportTicket.countDocuments({ status: 'Closed' }),
            HrmsSupportTicket.countDocuments({ priority: { $in: ['High', 'Urgent'] } })
        ]);

        // Recent activities (latest messages from employees or tickets created)
        const recentTickets = await HrmsSupportTicket.find()
            .sort({ updatedAt: -1 })
            .limit(5)
            .populate({ path: 'employeeId', populate: { path: 'adminId', select: 'name' } })
            .lean();

        return sendResponse(res, 200, 'Dashboard stats retrieved', {
            counts: { total, open, pending, inProgress, resolved, closed, highPriority },
            recentTickets
        });
    } catch (error) {
        next(error);
    }
};

export const getAdminTickets = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, status, search, priority, category } = req.query;
        const filter = {};

        if (status && status !== 'All') filter.status = status;
        if (priority && priority !== 'All') filter.priority = priority;
        if (category && category !== 'All') filter.category = category;

        if (search) {
            filter.$or = [
                { ticketId: { $regex: search, $options: 'i' } },
                { subject: { $regex: search, $options: 'i' } }
            ];
            // To search by employee name, we would need an aggregation or two-step query.
            // Keeping it simple with ticketId and subject for now.
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [tickets, total] = await Promise.all([
            HrmsSupportTicket.find(filter)
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate({ path: 'employeeId', populate: { path: 'adminId', select: 'name email' } })
                .populate('assignedAdminId', 'name')
                .lean(),
            HrmsSupportTicket.countDocuments(filter)
        ]);

        return sendResponse(res, 200, 'Tickets retrieved', {
            tickets,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (error) {
        next(error);
    }
};

export const changeTicketStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const ticket = await HrmsSupportTicket.findById(id);
        if (!ticket) return sendError(res, 404, 'Ticket not found');

        ticket.status = status;
        ticket.unreadByEmployee = true; // notify employee of status change
        await ticket.save();

        return sendResponse(res, 200, 'Ticket status updated', ticket);
    } catch (error) {
        next(error);
    }
};

export const assignTicket = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { adminId } = req.body; // Can be null to unassign

        const ticket = await HrmsSupportTicket.findById(id);
        if (!ticket) return sendError(res, 404, 'Ticket not found');

        ticket.assignedAdminId = adminId || null;
        await ticket.save();

        return sendResponse(res, 200, 'Ticket assigned successfully', ticket);
    } catch (error) {
        next(error);
    }
};

export const getAdminUnreadCount = async (req, res, next) => {
    try {
        const count = await HrmsSupportTicket.countDocuments({ unreadByAdmin: true });
        return sendResponse(res, 200, 'Unread count retrieved', { count });
    } catch (error) {
        next(error);
    }
};
