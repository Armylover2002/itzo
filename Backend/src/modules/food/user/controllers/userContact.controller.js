import { sendResponse, sendError } from '../../../../utils/response.js';
import { GlobalSettings } from '../../../common/models/settings.model.js';
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
        const { password } = req.query;

        const settings = await GlobalSettings.findOne();
        if (settings && settings.contactsViewPassword) {
            if (!password || password !== settings.contactsViewPassword) {
                return sendError(res, 401, 'Invalid or missing contacts view password');
            }
        }

        const result = await getCustomerContactsForAdmin(id, req.query || {});
        return sendResponse(res, 200, 'Customer contacts fetched successfully', result);
    } catch (error) {
        next(error);
    }
};
