import mongoose from 'mongoose';
import * as adminService from '../services/admin.service.js';
import { validateCategoryListQuery, validateCategoryRejectDto, validateCategoryUpsertDto } from '../validators/category.validator.js';
import { validateCreateOfferDto, validateUpdateOfferCartVisibilityDto } from '../validators/offer.validator.js';
import { validateAddDeliveryBonusDto } from '../validators/deliveryBonus.validator.js';
import { validateCheckCompletionsDto, validateEarningAddonHistoryActionDto, validateEarningAddonUpsertDto, validateToggleEarningAddonStatusDto } from '../validators/earningAddon.validator.js';
import { validateDeliveryCommissionRuleDto, validateOptionalStatusDto } from '../validators/commission.validator.js';
import { validateFeeSettingsUpsertDto } from '../validators/feeSettings.validator.js';
import { validateDeliveryEmergencyHelpUpsertDto } from '../validators/deliveryEmergencyHelp.validator.js';
import { validateReferralSettingsUpsertDto } from '../validators/referralSettings.validator.js';
import { resolveActionPerformerSnapshot } from '../../../../core/utils/performer.js';

// ----- Customers / Users -----
export async function getCustomers(req, res, next) {
    try {
        const data = await adminService.getCustomers(req.query || {});
        res.status(200).json({ success: true, message: 'Customers fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function getCustomerById(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid customer id' });
        }
        const customer = await adminService.getCustomerById(id);
        if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
        res.status(200).json({ success: true, message: 'Customer fetched successfully', data: { user: customer, customer } });
    } catch (error) {
        next(error);
    }
}

export async function updateCustomerStatus(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid customer id' });
        }
        const isActive = req.body?.isActive;
        const updated = await adminService.updateCustomerStatus(id, isActive);
        if (!updated) return res.status(404).json({ success: false, message: 'Customer not found' });
        res.status(200).json({ success: true, message: 'Customer status updated successfully', data: { user: updated, customer: updated } });
    } catch (error) {
        next(error);
    }
}

export async function getRecoveryRequests(req, res, next) {
    try {
        const data = await adminService.getRecoveryRequests(req.query || {});
        res.status(200).json({ success: true, message: 'Recovery requests fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function approveRecoveryRequest(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid customer id' });
        }
        const updated = await adminService.approveRecoveryRequest(id);
        if (!updated) return res.status(404).json({ success: false, message: 'Customer or request not found' });
        res.status(200).json({ success: true, message: 'Recovery request approved successfully', data: { user: updated } });
    } catch (error) {
        next(error);
    }
}

export async function rejectRecoveryRequest(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid customer id' });
        }
        const updated = await adminService.rejectRecoveryRequest(id);
        if (!updated) return res.status(404).json({ success: false, message: 'Customer or request not found' });
        res.status(200).json({ success: true, message: 'Recovery request rejected successfully', data: { user: updated } });
    } catch (error) {
        next(error);
    }
}

export async function softDeleteCustomer(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid customer id' });
        }

        // Verify password — same flow as contacts view
        const passwordInput = req.body.password || req.query.password;
        const password = passwordInput ? passwordInput.trim() : "";
        
        const { GlobalSettings } = await import('../../../common/models/settings.model.js');
        const settings = await GlobalSettings.findOne();
        
        if (settings && settings.contactsViewPassword) {
            if (!password || password !== settings.contactsViewPassword.trim()) {
                return res.status(401).json({ success: false, message: 'Invalid password' });
            }
        }

        const updated = await adminService.softDeleteCustomer(id);
        if (!updated) return res.status(404).json({ success: false, message: 'Customer not found or already deleted' });
        res.status(200).json({ success: true, message: 'Customer deleted successfully', data: { user: updated } });
    } catch (error) {
        next(error);
    }
}

export async function updateCustomerCodAccess(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid customer id' });
        }
        const isCodAllowed = req.body?.isCodAllowed;
        const updated = await adminService.updateCustomerCodAccess(id, isCodAllowed);
        if (!updated) return res.status(404).json({ success: false, message: 'Customer not found' });
        res.status(200).json({ success: true, message: 'Customer COD access updated successfully', data: { user: updated, customer: updated } });
    } catch (error) {
        next(error);
    }
}

export async function updateDeliveryPartnerActiveStatus(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid delivery partner id'
            });
        }

        const isActive = req.body?.isActive;
        if (typeof isActive !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'isActive must be a boolean'
            });
        }

        const partner = await adminService.updateDeliveryPartnerActiveStatus(id, isActive);
        if (!partner) {
            return res.status(404).json({
                success: false,
                message: 'Delivery partner not found'
            });
        }

        res.status(200).json({
            success: true,
            message: `Delivery partner ${isActive ? 'activated' : 'deactivated'} successfully`,
            data: partner
        });
    } catch (error) {
        next(error);
    }
}

export async function bulkUpdateCustomersCodAccess(req, res, next) {
    try {
        const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
        const isCodAllowed = req.body?.isCodAllowed;
        const result = await adminService.bulkUpdateCustomersCodAccess(ids, isCodAllowed);
        res.status(200).json({
            success: true,
            message: 'Bulk customer COD access updated successfully',
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

// ----- Safety / Emergency Reports -----
export async function getSafetyEmergencyReports(req, res, next) {
    try {
        const data = await adminService.getSafetyEmergencyReports(req.query || {});
        res.status(200).json({ success: true, message: 'Safety emergency reports fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function updateSafetyEmergencyStatus(req, res, next) {
    try {
        const { id } = req.params;
        const updated = await adminService.updateSafetyEmergencyStatus(id, req.body?.status);
        if (!updated) return res.status(404).json({ success: false, message: 'Report not found' });
        res.status(200).json({ success: true, message: 'Status updated successfully', data: { report: updated } });
    } catch (error) {
        next(error);
    }
}

export async function updateSafetyEmergencyPriority(req, res, next) {
    try {
        const { id } = req.params;
        const updated = await adminService.updateSafetyEmergencyPriority(id, req.body?.priority);
        if (!updated) return res.status(404).json({ success: false, message: 'Report not found' });
        res.status(200).json({ success: true, message: 'Priority updated successfully', data: { report: updated } });
    } catch (error) {
        next(error);
    }
}

export async function deleteSafetyEmergencyReport(req, res, next) {
    try {
        const { id } = req.params;
        const deleted = await adminService.deleteSafetyEmergencyReport(id);
        if (!deleted) return res.status(404).json({ success: false, message: 'Report not found' });
        res.status(200).json({ success: true, message: 'Safety emergency report deleted successfully', data: { report: deleted } });
    } catch (error) {
        next(error);
    }
}

export async function updateRestaurantComplaint(req, res, next) {
    try {
        const { id } = req.params;
        const { status, adminResponse } = req.body;
        const updated = await adminService.updateRestaurantComplaint(id, { status, adminResponse });
        res.status(200).json({ success: true, message: 'Complaint updated successfully', data: { complaint: updated } });
    } catch (error) {
        next(error);
    }
}

// ----- Restaurants -----
export async function getRestaurantComplaints(req, res, next) {
    try {
        const data = await adminService.getRestaurantComplaints(req.query || {});
        res.status(200).json({ success: true, message: 'Restaurant complaints fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function globalSearch(req, res, next) {
    try {
        const { query } = req.query;
        const data = await adminService.globalSearch(query);
        res.status(200).json({
            success: true,
            message: 'Global search results fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getRestaurants(req, res, next) {
    try {
        const data = await adminService.getRestaurants(req.query);
        res.status(200).json({
            success: true,
            message: 'Restaurants fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getRestaurantReport(req, res, next) {
    try {
        const data = await adminService.getRestaurantReport(req.query || {});
        res.status(200).json({
            success: true,
            message: 'Restaurant report fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getDashboardStats(req, res, next) {
    try {
        const data = await adminService.getDashboardStats(req.query || {});
        res.status(200).json({
            success: true,
            message: 'Dashboard stats fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getTransactionReport(req, res, next) {
    try {
        const data = await adminService.getTransactionReport(req.query || {});
        res.status(200).json({
            success: true,
            message: 'Transaction report fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getTaxReport(req, res, next) {
    try {
        const data = await adminService.getTaxReport(req.query || {});
        res.status(200).json({
            success: true,
            message: 'Tax report fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getTaxReportDetail(req, res, next) {
    try {
        const { id } = req.params;
        const data = await adminService.getTaxReportDetail(id, req.query || {});
        res.status(200).json({
            success: true,
            message: 'Tax report detail fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getRestaurantReviews(req, res, next) {
    try {
        const data = await adminService.getRestaurantReviews(req.query);
        res.status(200).json({
            success: true,
            message: 'Restaurant reviews fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getRestaurantById(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid restaurant id' });
        }
        const restaurant = await adminService.getRestaurantById(id);
        if (!restaurant) {
            return res.status(404).json({ success: false, message: 'Restaurant not found' });
        }
        res.status(200).json({
            success: true,
            message: 'Restaurant fetched successfully',
            data: restaurant
        });
    } catch (error) {
        next(error);
    }
}

export async function getRestaurantAnalytics(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid restaurant id' });
        }
        const data = await adminService.getRestaurantAnalytics(id);
        if (!data) {
            return res.status(404).json({ success: false, message: 'Restaurant not found' });
        }
        res.status(200).json({
            success: true,
            message: 'Restaurant analytics fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getRestaurantMenuById(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid restaurant id' });
        }
        const menu = await adminService.getRestaurantMenuById(id);
        if (!menu) {
            return res.status(404).json({ success: false, message: 'Restaurant not found' });
        }
        res.status(200).json({ success: true, message: 'Menu fetched successfully', data: { menu } });
    } catch (error) {
        next(error);
    }
}

export async function updateRestaurantMenuById(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid restaurant id' });
        }
        const menu = await adminService.updateRestaurantMenuById(id, req.body || {});
        if (!menu) {
            return res.status(404).json({ success: false, message: 'Restaurant not found' });
        }
        res.status(200).json({ success: true, message: 'Menu updated successfully', data: { menu } });
    } catch (error) {
        next(error);
    }
}

export async function updateRestaurantById(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid restaurant id' });
        }
        const updated = await adminService.updateRestaurantById(id, req.body || {});
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Restaurant not found' });
        }
        res.status(200).json({ success: true, message: 'Restaurant updated successfully', data: { restaurant: updated } });
    } catch (error) {
        next(error);
    }
}

export async function updateRestaurantStatus(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid restaurant id' });
        }
        const updated = await adminService.updateRestaurantStatus(id, req.body || {});
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Restaurant not found' });
        }
        res.status(200).json({ success: true, message: 'Restaurant status updated successfully', data: { restaurant: updated } });
    } catch (error) {
        next(error);
    }
}

export async function updateRestaurantLocation(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid restaurant id' });
        }
        const updated = await adminService.updateRestaurantLocation(id, req.body || {});
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Restaurant not found' });
        }
        res.status(200).json({ success: true, message: 'Restaurant location updated successfully', data: { restaurant: updated } });
    } catch (error) {
        next(error);
    }
}

// ----- Foods -----
export async function getFoods(req, res, next) {
    try {
        const data = await adminService.getFoods(req.query || {});
        res.status(200).json({ success: true, message: 'Foods fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function createFood(req, res, next) {
    try {
        const created = await adminService.createFood(req.body || {});
        res.status(201).json({ success: true, message: 'Food created successfully', data: { food: created } });
    } catch (error) {
        next(error);
    }
}

export async function updateFood(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid food id' });
        }
        const updated = await adminService.updateFood(id, req.body || {});
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Food not found' });
        }
        res.status(200).json({ success: true, message: 'Food updated successfully', data: { food: updated } });
    } catch (error) {
        next(error);
    }
}

export async function deleteFood(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid food id' });
        }
        const result = await adminService.deleteFood(id);
        if (!result) {
            return res.status(404).json({ success: false, message: 'Food not found' });
        }
        res.status(200).json({ success: true, message: 'Food deleted successfully', data: result });
    } catch (error) {
        next(error);
    }
}

// ----- Categories -----
export async function getCategories(req, res, next) {
    try {
        const query = validateCategoryListQuery(req.query || {});
        const data = await adminService.getCategories(query);
        res.status(200).json({ success: true, message: 'Categories fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function createCategory(req, res, next) {
    try {
        const body = validateCategoryUpsertDto(req.body || {});
        const created = await adminService.createCategory(body);
        res.status(201).json({ success: true, message: 'Category created successfully', data: { category: created } });
    } catch (error) {
        next(error);
    }
}

export async function updateCategory(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid category id' });
        }
        const body = validateCategoryUpsertDto(req.body || {});
        const updated = await adminService.updateCategory(id, body);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }
        res.status(200).json({ success: true, message: 'Category updated successfully', data: { category: updated } });
    } catch (error) {
        next(error);
    }
}

export async function deleteCategory(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid category id' });
        }
        const result = await adminService.deleteCategory(id);
        if (!result) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }
        res.status(200).json({ success: true, message: 'Category deleted successfully', data: result });
    } catch (error) {
        next(error);
    }
}

export async function toggleCategoryStatus(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid category id' });
        }
        const updated = await adminService.toggleCategoryStatus(id);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }
        res.status(200).json({ success: true, message: 'Category status updated successfully', data: { category: updated } });
    } catch (error) {
        next(error);
    }
}

export async function approveCategory(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid category id' });
        }
        const updated = await adminService.approveCategory(id);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Category not found or already approved' });
        }
        res.status(200).json({ success: true, message: 'Category approved successfully', data: { category: updated } });
    } catch (error) {
        next(error);
    }
}

export async function rejectCategory(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid category id' });
        }
        const body = validateCategoryRejectDto(req.body || {});
        const updated = await adminService.rejectCategory(id, body.reason);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }
        res.status(200).json({ success: true, message: 'Category rejected successfully', data: { category: updated } });
    } catch (error) {
        next(error);
    }
}

export async function makeCategoryGlobal(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid category id' });
        }
        const updated = await adminService.makeCategoryGlobal(id);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }
        res.status(200).json({ success: true, message: 'Category is now global', data: { category: updated } });
    } catch (error) {
        next(error);
    }
}

// ----- Offers & Coupons -----
export async function getAllOffers(req, res, next) {
    try {
        const data = await adminService.getAllOffers(req.query || {});
        res.status(200).json({ success: true, message: 'Offers fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function createAdminOffer(req, res, next) {
    try {
        const body = validateCreateOfferDto(req.body || {});
        const created = await adminService.createAdminOffer(body);
        res.status(201).json({ success: true, message: 'Offer created successfully', data: { offer: created } });
    } catch (error) {
        next(error);
    }
}

export async function updateAdminOfferCartVisibility(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid offer id' });
        }
        const body = validateUpdateOfferCartVisibilityDto(req.body || {});
        const updated = await adminService.updateAdminOfferCartVisibility(id, body.itemId, body.showInCart);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Offer not found' });
        }
        res.status(200).json({ success: true, message: 'Offer updated successfully', data: { offer: updated } });
    } catch (error) {
        next(error);
    }
}

export async function deleteAdminOffer(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid offer id' });
        }
        const result = await adminService.deleteAdminOffer(id);
        if (!result) {
            return res.status(404).json({ success: false, message: 'Offer not found' });
        }
        res.status(200).json({ success: true, message: 'Offer deleted successfully', data: result });
    } catch (error) {
        next(error);
    }
}

export async function getSupportTicketsController(req, res, next) {
    try {
        const data = await adminService.getSupportTickets(req.query || {});
        res.status(200).json({ success: true, message: 'Support tickets fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function updateSupportTicketController(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid ticket id' });
        }
        const updated = await adminService.updateSupportTicket(id, req.body || {});
        if (!updated) return res.status(404).json({ success: false, message: 'Ticket not found' });
        res.status(200).json({ success: true, message: 'Support ticket updated successfully', data: { ticket: updated } });
    } catch (error) {
        next(error);
    }
}

export async function getPendingRestaurants(req, res, next) {
    try {
        const pending = await adminService.getPendingRestaurants();
        res.status(200).json({
            success: true,
            message: 'Pending restaurants fetched successfully',
            data: pending
        });
    } catch (error) {
        next(error);
    }
}

// ----- Delivery partner bonus (admin) -----
export async function getDeliveryPartnerBonusTransactions(req, res, next) {
    try {
        const data = await adminService.getDeliveryPartnerBonusTransactions(req.query || {});
        res.status(200).json({ success: true, message: 'Bonus transactions fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function addDeliveryPartnerBonus(req, res, next) {
    try {
        const body = validateAddDeliveryBonusDto(req.body || {});
        const created = await adminService.addDeliveryPartnerBonus(body, req.user);
        res.status(201).json({ success: true, message: 'Bonus added successfully', data: { transaction: created } });
    } catch (error) {
        next(error);
    }
}

export async function getDeliveryEarnings(req, res, next) {
    try {
        const data = await adminService.getDeliveryEarnings(req.query || {});
        res.status(200).json({ success: true, message: 'Delivery earnings fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

// ----- Earning Addon (admin) -----
export async function getEarningAddons(req, res, next) {
    try {
        const data = await adminService.getEarningAddons();
        res.status(200).json({ success: true, message: 'Earning addons fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function createEarningAddon(req, res, next) {
    try {
        const body = validateEarningAddonUpsertDto(req.body || {});
        const created = await adminService.createEarningAddon(body);
        res.status(201).json({ success: true, message: 'Earning addon created successfully', data: { earningAddon: created } });
    } catch (error) {
        next(error);
    }
}

export async function updateEarningAddon(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid earning addon id' });
        }
        const body = validateEarningAddonUpsertDto(req.body || {});
        const updated = await adminService.updateEarningAddon(id, body);
        if (!updated) {
            return res.status(404).json({ success: 'Earning addon not found' });
        }
        res.status(200).json({ success: true, message: 'Earning addon updated successfully', data: { earningAddon: updated } });
    } catch (error) {
        next(error);
    }
}

export async function deleteEarningAddon(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid earning addon id' });
        }
        const result = await adminService.deleteEarningAddon(id);
        if (!result) {
            return res.status(404).json({ success: false, message: 'Earning addon not found' });
        }
        res.status(200).json({ success: true, message: 'Earning addon deleted successfully', data: result });
    } catch (error) {
        next(error);
    }
}

export async function toggleEarningAddonStatus(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid earning addon id' });
        }
        const { status } = validateToggleEarningAddonStatusDto(req.body || {});
        const updated = await adminService.toggleEarningAddonStatus(id, status);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Earning addon not found' });
        }
        res.status(200).json({ success: true, message: 'Status updated successfully', data: { earningAddon: updated } });
    } catch (error) {
        next(error);
    }
}

export async function getEarningAddonHistory(req, res, next) {
    try {
        const data = await adminService.getEarningAddonHistory(req.query || {});
        res.status(200).json({ success: true, message: 'Earning addon history fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function creditEarningToWallet(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid history id' });
        }
        const { notes } = validateEarningAddonHistoryActionDto(req.body || {});
        const updated = await adminService.creditEarningAddonHistory(id, notes);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'History record not found' });
        }
        res.status(200).json({ success: true, message: 'Earning credited successfully', data: { history: updated } });
    } catch (error) {
        next(error);
    }
}

export async function cancelEarningAddonHistory(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid history id' });
        }
        const { reason } = validateEarningAddonHistoryActionDto(req.body || {});
        const updated = await adminService.cancelEarningAddonHistory(id, reason);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'History record not found' });
        }
        res.status(200).json({ success: true, message: 'Earning cancelled successfully', data: { history: updated } });
    } catch (error) {
        next(error);
    }
}

export async function checkEarningAddonCompletions(req, res, next) {
    try {
        const { deliveryPartnerId, force } = validateCheckCompletionsDto(req.body || {});
        const data = await adminService.checkEarningAddonCompletions(deliveryPartnerId, force);
        res.status(200).json({ success: true, message: 'Completion check done', data });
    } catch (error) {
        next(error);
    }
}

// ----- Delivery commission rules (admin) -----
export async function getDeliveryCommissionRules(req, res, next) {
    try {
        const data = await adminService.getDeliveryCommissionRules();
        res.status(200).json({ success: true, message: 'Commission rules fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function createDeliveryCommissionRule(req, res, next) {
    try {
        const body = validateDeliveryCommissionRuleDto(req.body || {});
        const created = await adminService.createDeliveryCommissionRule(body);
        res.status(201).json({ success: true, message: 'Commission rule created successfully', data: { commission: created } });
    } catch (error) {
        next(error);
    }
}

export async function updateDeliveryCommissionRule(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid commission id' });
        }
        const body = validateDeliveryCommissionRuleDto(req.body || {});
        const updated = await adminService.updateDeliveryCommissionRule(id, body);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Commission rule not found' });
        }
        res.status(200).json({ success: true, message: 'Commission rule updated successfully', data: { commission: updated } });
    } catch (error) {
        next(error);
    }
}

export async function deleteDeliveryCommissionRule(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid commission id' });
        }
        const result = await adminService.deleteDeliveryCommissionRule(id);
        if (!result) {
            return res.status(404).json({ success: false, message: 'Commission rule not found' });
        }
        res.status(200).json({ success: true, message: 'Commission rule deleted successfully', data: result });
    } catch (error) {
        next(error);
    }
}

export async function toggleDeliveryCommissionRuleStatus(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid commission id' });
        }
        const { status } = validateOptionalStatusDto(req.body || {});
        if (typeof status !== 'boolean') {
            return res.status(400).json({ success: false, message: 'status is required' });
        }
        const updated = await adminService.toggleDeliveryCommissionRuleStatus(id, status);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Commission rule not found' });
        }
        res.status(200).json({ success: true, message: 'Status updated successfully', data: { commission: updated } });
    } catch (error) {
        next(error);
    }
}

// ----- Fee Settings (admin) -----
export async function getFeeSettings(req, res, next) {
    try {
        const data = await adminService.getFeeSettings();
        res.status(200).json({ success: true, message: 'Fee settings fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function createOrUpdateFeeSettings(req, res, next) {
    try {
        const body = validateFeeSettingsUpsertDto(req.body || {});
        const feeSettings = await adminService.upsertFeeSettings(body);
        res.status(200).json({ success: true, message: 'Fee settings saved successfully', data: { feeSettings } });
    } catch (error) {
        next(error);
    }
}

// ----- Referral Settings (admin) -----
export async function getReferralSettings(req, res, next) {
    try {
        const data = await adminService.getReferralSettings();
        res.status(200).json({ success: true, message: 'Referral settings fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function createOrUpdateReferralSettings(req, res, next) {
    try {
        const body = validateReferralSettingsUpsertDto(req.body || {});
        const referralSettings = await adminService.upsertReferralSettings(body);
        res.status(200).json({ success: true, message: 'Referral settings saved successfully', data: { referralSettings } });
    } catch (error) {
        next(error);
    }
}

// ----- Delivery Cash Limit (admin) -----
export async function getDeliveryCashLimit(req, res, next) {
    try {
        const data = await adminService.getDeliveryCashLimitSettings();
        res.status(200).json({ success: true, message: 'Delivery cash limit fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function updateDeliveryCashLimit(req, res, next) {
    try {
        const data = await adminService.upsertDeliveryCashLimitSettings(req.body || {});
        res.status(200).json({ success: true, message: 'Delivery cash limit updated successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function updateDeliveryCashDepositStatus(req, res, next) {
    try {
        const { id } = req.params;
        const { status, adminNote } = req.body;
        const data = await adminService.updateDeliveryCashDepositStatus(id, status, adminNote, req.user);
        res.status(200).json({ success: true, message: `Deposit marked as ${status}`, data });
    } catch (error) {
        next(error);
    }
}

// ----- Delivery Emergency Help (admin) -----
export async function getEmergencyHelp(req, res, next) {
    try {
        const data = await adminService.getDeliveryEmergencyHelp();
        res.status(200).json({ success: true, message: 'Emergency help fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function createOrUpdateEmergencyHelp(req, res, next) {
    try {
        const body = validateDeliveryEmergencyHelpUpsertDto(req.body || {});
        const data = await adminService.upsertDeliveryEmergencyHelp(body);
        res.status(200).json({ success: true, message: 'Emergency help saved successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function approveRestaurant(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid restaurant id'
            });
        }
        const performer = await resolveActionPerformerSnapshot(req.user);
        const restaurant = await adminService.approveRestaurant(id, performer);
        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: 'Restaurant not found'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Restaurant approved successfully',
            data: restaurant
        });
    } catch (error) {
        next(error);
    }
}

export async function createRestaurant(req, res, next) {
    try {
        const restaurant = await adminService.createRestaurantByAdmin(req.body || {});
        res.status(201).json({
            success: true,
            message: 'Restaurant created successfully',
            data: restaurant
        });
    } catch (error) {
        next(error);
    }
}

export async function rejectRestaurant(req, res, next) {
    try {
        const { id } = req.params;
        const { reason } = req.body || {};
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid restaurant id'
            });
        }
        if (!reason) {
            return res.status(400).json({ success: false, message: 'Rejection reason is required' });
        }
        const performer = await resolveActionPerformerSnapshot(req.user);
        const restaurant = await adminService.rejectRestaurant(id, reason, performer);
        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: 'Restaurant not found'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Restaurant rejected successfully',
            data: restaurant
        });
    } catch (error) {
        next(error);
    }
}

// ----- Delivery join requests -----
export async function getDeliveryJoinRequests(req, res, next) {
    try {
        const data = await adminService.getDeliveryJoinRequests(req.query);
        res.status(200).json({
            success: true,
            message: 'Delivery join requests fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}


// ----- Support tickets -----
export async function getSupportTicketStats(req, res, next) {
    try {
        const data = await adminService.getSupportTicketStats();
        res.status(200).json({
            success: true,
            message: 'Support ticket stats fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getSupportTickets(req, res, next) {
    try {
        const data = await adminService.getDeliverySupportTickets(req.query);
        res.status(200).json({
            success: true,
            message: 'Support tickets fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function updateSupportTicket(req, res, next) {
    try {
        const ticket = await adminService.updateDeliverySupportTicket(req.params.id, req.body);
        if (!ticket) {
            return res.status(404).json({
                success: false,
                message: 'Support ticket not found'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Support ticket updated successfully',
            data: ticket
        });
    } catch (error) {
        next(error);
    }
}

// ----- Delivery partners -----
export async function getDeliveryPartners(req, res, next) {
    try {
        const data = await adminService.getDeliveryPartners(req.query);
        res.status(200).json({
            success: true,
            message: 'Delivery partners fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getDeliverymanReviews(req, res, next) {
    try {
        const data = await adminService.getDeliverymanReviews(req.query);
        res.status(200).json({
            success: true,
            message: 'Deliveryman reviews fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getContactMessages(req, res, next) {
    try {
        const data = await adminService.getContactMessages(req.query);
        res.status(200).json({
            success: true,
            message: 'Contact messages fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getDeliveryPartnerById(req, res, next) {
    try {
        const delivery = await adminService.getDeliveryPartnerById(req.params.id);
        if (!delivery) {
            return res.status(404).json({
                success: false,
                message: 'Delivery partner not found'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Delivery partner fetched successfully',
            data: { delivery }
        });
    } catch (error) {
        next(error);
    }
}

export async function approveDeliveryPartner(req, res, next) {
    try {
        const performer = await resolveActionPerformerSnapshot(req.user);
        const partner = await adminService.approveDeliveryPartner(req.params.id, performer);
        if (!partner) {
            return res.status(404).json({
                success: false,
                message: 'Delivery partner not found'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Delivery partner approved successfully',
            data: partner
        });
    } catch (error) {
        next(error);
    }
}

export async function rejectDeliveryPartner(req, res, next) {
    try {
        const { reason } = req.body;
        const performer = await resolveActionPerformerSnapshot(req.user);
        const partner = await adminService.rejectDeliveryPartner(req.params.id, reason, performer);
        if (!partner) {
            return res.status(404).json({
                success: false,
                message: 'Delivery partner not found'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Delivery partner rejected successfully',
            data: partner
        });
    } catch (error) {
        next(error);
    }
}

// ----- Zones -----
export async function getZones(req, res, next) {
    try {
        const data = await adminService.getZones(req.query);
        res.status(200).json({
            success: true,
            message: 'Zones fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getZoneById(req, res, next) {
    try {
        const zone = await adminService.getZoneById(req.params.id);
        if (!zone) {
            return res.status(404).json({
                success: false,
                message: 'Zone not found'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Zone fetched successfully',
            data: { zone }
        });
    } catch (error) {
        next(error);
    }
}

export async function createZone(req, res, next) {
    try {
        const result = await adminService.createZone(req.body || {});
        if (result.error) {
            return res.status(400).json({
                success: false,
                message: result.error
            });
        }
        res.status(201).json({
            success: true,
            message: 'Zone created successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
}

export async function updateZone(req, res, next) {
    try {
        const result = await adminService.updateZone(req.params.id, req.body || {});
        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Zone not found'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Zone updated successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
}

export async function deleteZone(req, res, next) {
    try {
        const result = await adminService.deleteZone(req.params.id);
        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Zone not found'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Zone deleted successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
}

export async function processRefund(req, res, next) {
    try {
        const { orderId } = req.params;
        const { refundAmount, refundTo } = req.body;
        if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ success: false, message: 'Invalid order id' });
        }
        
        // This is a stub for the actual refund logic.
        // We will assume adminService.processRefund exists and handles the refund.
        const updated = await adminService.processRefund(orderId, refundAmount, refundTo);
        
        // Let's add the push notification here if we have access to the user ID
        // First we need to get the order to find the user ID
        const order = await mongoose.model('FoodOrder').findById(orderId).lean();
        
        if (order && order.userId) {
            const { notifyOwnersSafely } = await import('../../../../core/notifications/firebase.service.js');
            await notifyOwnersSafely(
                [{ ownerType: 'USER', ownerId: order.userId }],
                {
                    title: 'Refund Processed! 💸',
                    body: `Your refund of ₹${refundAmount || order.totalAmount || order.total || 0} for Order #${order.orderId} has been processed successfully.`,
                    image: 'https://i.ibb.co/3m2Yh7r/Appzeto-Brand-Image.png',
                    data: {
                        type: 'refund_processed',
                        orderId: String(order.orderId),
                        orderMongoId: String(order._id)
                    }
                }
            );
        }
        
        res.status(200).json({ success: true, message: 'Refund processed successfully', data: updated });
    } catch (error) {
        next(error);
    }
}
export async function getWithdrawals(req, res, next) {
    try {
        const data = await adminService.getWithdrawals(req.query || {});
        res.status(200).json({ success: true, message: 'Withdrawals fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function updateWithdrawalStatus(req, res, next) {
    try {
        const { id } = req.params;
        const data = await adminService.updateWithdrawalStatus(id, req.body || {});
        res.status(200).json({ success: true, message: 'Withdrawal status updated successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function getDeliveryWithdrawals(req, res, next) {
    try {
        const data = await adminService.getDeliveryWithdrawals(req.query || {});
        res.status(200).json({ success: true, message: 'Delivery withdrawals fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function updateDeliveryWithdrawalStatus(req, res, next) {
    try {
        const { id } = req.params;
        const data = await adminService.updateDeliveryWithdrawalStatus(id, req.body || {});
        res.status(200).json({ success: true, message: 'Delivery withdrawal status updated successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function getDeliveryWallets(req, res, next) {
    try {
        const data = await adminService.getDeliveryWallets(req.query || {});
        res.status(200).json({ success: true, message: 'Delivery wallets fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function updateDeliveryBoyWallet(req, res, next) {
    try {
        const data = await adminService.updateDeliveryBoyWallet(req.body || {});
        res.status(200).json({ success: true, message: 'Wallet updated successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function getCashLimitSettlements(req, res, next) {
    try {
        const data = await adminService.getCashLimitSettlements(req.query || {});
        res.status(200).json({ success: true, message: 'Cash limit settlements fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function getCashPayRequests(req, res, next) {
    try {
        const data = await adminService.getCashPayRequests(req.query || {});
        res.status(200).json({ success: true, message: 'Cash pay requests fetched successfully', data });
    } catch (error) {
        next(error);
    }
}


export async function getSidebarBadges(req, res, next) {
    try {
        const counts = await adminService.getSidebarBadges();
        res.status(200).json({ success: true, counts });
    } catch (error) {
        next(error);
    }
}

export async function getExpiredFssaiNotifications(req, res, next) {
    try {
        const { listExpiredFssaiRestaurants } = await import('../../restaurant/services/fssaiExpiry.service.js');
        const items = await listExpiredFssaiRestaurants();
        res.status(200).json({
            success: true,
            message: 'Expired FSSAI notifications fetched successfully',
            data: { items }
        });
    } catch (error) {
        next(error);
    }
}
