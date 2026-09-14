import { sendResponse } from '../../../../utils/response.js';
import { RoleRequest } from '../../admin/models/roleRequest.model.js';

export const submitRoleRequestController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { role, details } = req.body;
        
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized access' });
        }
        if (!role || !['RESTAURANT', 'SELLER', 'DELIVERY_BOY'].includes(role)) {
            return res.status(400).json({ success: false, message: 'Invalid or missing role parameter' });
        }
        if (!details || typeof details !== 'object') {
            return res.status(400).json({ success: false, message: 'Missing or invalid request details object' });
        }

        // Check if there is already an active pending request of the same type
        const existing = await RoleRequest.findOne({ userId, role, status: 'PENDING' });
        if (existing) {
            return res.status(400).json({ success: false, message: `You already have a pending ${role.toLowerCase()} request.` });
        }

        const request = await RoleRequest.create({
            userId,
            role,
            details
        });

        return sendResponse(res, 201, 'Role request submitted successfully', request);
    } catch (error) {
        next(error);
    }
};

export const listMyRoleRequestsController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized access' });
        }
        const requests = await RoleRequest.find({ userId }).sort({ createdAt: -1 });
        return sendResponse(res, 200, 'My role requests retrieved successfully', requests);
    } catch (error) {
        next(error);
    }
};

export const updateRoleRequestController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        const { details } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized access' });
        }
        if (!details || typeof details !== 'object') {
            return res.status(400).json({ success: false, message: 'Missing or invalid request details object' });
        }

        const request = await RoleRequest.findOne({ _id: id, userId });
        if (!request) {
            return res.status(404).json({ success: false, message: 'Role request not found' });
        }
        if (request.status !== 'PENDING') {
            return res.status(400).json({ success: false, message: 'Only pending requests can be edited.' });
        }

        request.details = details;
        await request.save();

        return sendResponse(res, 200, 'Role request updated successfully', request);
    } catch (error) {
        next(error);
    }
};

export const deleteRoleRequestController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized access' });
        }

        const request = await RoleRequest.findOne({ _id: id, userId });
        if (!request) {
            return res.status(404).json({ success: false, message: 'Role request not found' });
        }
        if (!['PENDING', 'REJECTED'].includes(request.status)) {
            return res.status(400).json({ success: false, message: 'Approved requests cannot be deleted.' });
        }

        await RoleRequest.deleteOne({ _id: id });

        return sendResponse(res, 200, 'Role request deleted successfully', null);
    } catch (error) {
        next(error);
    }
};
