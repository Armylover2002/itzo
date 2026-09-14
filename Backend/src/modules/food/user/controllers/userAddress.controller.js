import { sendResponse } from '../../../../utils/response.js';
import {
    listAddresses,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress
} from '../services/userAddress.service.js';
import { validateCreateAddressDto, validateUpdateAddressDto } from '../validators/userAddress.validator.js';

export const listAddressesController = async (req, res, next) => {
    try {
        const { userId } = req.user;
        const result = await listAddresses(userId);
        return sendResponse(res, 200, 'Addresses retrieved successfully', result);
    } catch (err) {
        next(err);
    }
};

export const addAddressController = async (req, res, next) => {
    try {
        const { userId } = req.user;
        const dto = validateCreateAddressDto(req.body);
        const result = await addAddress(userId, dto);
        return sendResponse(res, 201, 'Address saved successfully', result);
    } catch (err) {
        next(err);
    }
};

export const updateAddressController = async (req, res, next) => {
    try {
        const { userId } = req.user;
        const { addressId } = req.params;
        const dto = validateUpdateAddressDto(req.body);
        const result = await updateAddress(userId, addressId, dto);
        return sendResponse(res, 200, 'Address updated successfully', result);
    } catch (err) {
        next(err);
    }
};

export const deleteAddressController = async (req, res, next) => {
    try {
        const { userId } = req.user;
        const { addressId } = req.params;
        const result = await deleteAddress(userId, addressId);
        return sendResponse(res, 200, 'Address deleted successfully', result);
    } catch (err) {
        next(err);
    }
};

export const setDefaultAddressController = async (req, res, next) => {
    try {
        const { userId } = req.user;
        const { addressId } = req.params;
        const result = await setDefaultAddress(userId, addressId);
        return sendResponse(res, 200, 'Default address updated successfully', result);
    } catch (err) {
        next(err);
    }
};

