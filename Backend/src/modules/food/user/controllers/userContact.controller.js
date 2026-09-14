import { sendResponse } from '../../../../utils/response.js';
import {
    validateUserContactImportDto,
    validateUserContactPermissionStatusDto
} from '../validators/userContact.validator.js';
import {
    importUserContacts,
    updatePermissionStatus,
    getCustomerContactsForAdmin
} from '../services/userContact.service.js';

export const importContactsController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const body = validateUserContactImportDto(req.body);
        const result = await importUserContacts(userId, body.contacts, body.isLastChunk);
        return sendResponse(res, 200, 'Contacts imported successfully', result);
    } catch (error) {
        next(error);
    }
};

export const updatePermissionStatusController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const body = validateUserContactPermissionStatusDto(req.body);
        const result = await updatePermissionStatus(userId, body.status);
        return sendResponse(res, 200, 'Permission status updated successfully', result);
    } catch (error) {
        next(error);
    }
};

export const getCustomerContactsAdminController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await getCustomerContactsForAdmin(id, req.query || {});
        return sendResponse(res, 200, 'Customer contacts fetched successfully', result);
    } catch (error) {
        next(error);
    }
};
