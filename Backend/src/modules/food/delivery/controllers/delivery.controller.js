import mongoose from 'mongoose';
import { FoodDeliveryCashDeposit } from '../models/foodDeliveryCashDeposit.model.js';
import { registerDeliveryPartner, updateDeliveryPartnerProfile, updateDeliveryPartnerBankDetails, listSupportTicketsByPartner, createSupportTicket, getSupportTicketByIdAndPartner, updateDeliveryPartnerDetails, updateDeliveryPartnerProfilePhotoBase64, updateDeliveryAvailability, getDeliveryPartnerWallet, getDeliveryPartnerEarnings, getDeliveryPartnerTripHistory, getDeliveryPocketDetails, getActiveEarningAddonsForPartner, deleteDeliveryPartnerAccount, getDeliveryPartnerVehicles, setDeliveryPartnerActiveVehicle, getDriverMapContext, validateUniqueDocuments, resolveDocumentValidationExcludePartnerId, getSignupVehicleCatalog } from '../services/delivery.service.js';
import { createDeliveryCashDepositOrder, getDeliveryPartnerWalletEnhanced, requestDeliveryWithdrawal, verifyDeliveryCashDepositPayment } from '../services/deliveryFinance.service.js';
import { getDeliveryCashLimitSettings, getDeliveryEmergencyHelp } from '../../admin/services/admin.service.js';
import { DeliveryBonusTransaction } from '../../admin/models/deliveryBonusTransaction.model.js';
import { validateDeliveryRegisterDto, validateDeliveryProfileUpdateDto, validateDeliveryBankDetailsDto } from '../validators/delivery.validator.js';
import { sendResponse } from '../../../../utils/response.js';
import { getDeliveryReferralStats } from '../services/deliveryReferral.service.js';
import {
    mapDeliveryPartnerRegistrationResponse,
    mapDeliveryPartnerProfileCompletionResponse,
} from '../utils/deliveryPartnerResponse.mapper.js';

export const validateDocumentsController = async (req, res, next) => {
    try {
        let excludeUserId = req.user?.userId || null;
        // Public reapply (Edit Existing / Create New): no JWT — resolve self by phone/partnerId.
        if (!excludeUserId) {
            excludeUserId = await resolveDocumentValidationExcludePartnerId(req.body || {});
        }
        await validateUniqueDocuments(req.body, excludeUserId);
        return sendResponse(res, 200, 'Documents are valid');
    } catch (error) {
        if (error.statusCode === 409) {
            return res.status(409).json({
                success: false,
                message: error.message,
                errors: error.errors
            });
        }
        next(error);
    }
};

export const getSignupVehicleCatalogController = async (req, res, next) => {
    try {
        const vehicles = await getSignupVehicleCatalog();
        return sendResponse(res, 200, 'Signup vehicles fetched', { vehicles });
    } catch (error) {
        next(error);
    }
};

export const registerDeliveryPartnerController = async (req, res, next) => {
    try {
        const validated = validateDeliveryRegisterDto(req.body);
        
        const requiredFiles = ['profilePhoto', 'aadharPhoto', 'panPhoto', 'drivingLicensePhoto'];
        const submissionType = String(validated?.submissionType || req.body?.submissionType || '')
            .trim()
            .toLowerCase();
        const isEditExisting = submissionType === 'edit_existing';
        const missingFiles = requiredFiles.filter(
            (field) => !req.files || !req.files[field] || req.files[field].length === 0
        );
        // edit_existing may reuse prior document URLs from the rejected submission snapshot.
        if (missingFiles.length > 0 && !isEditExisting) {
            return res.status(400).json({
                success: false,
                message: `Missing required document photos: ${missingFiles.join(', ')}`
            });
        }
        const partner = await registerDeliveryPartner(
            { ...validated, submissionType: submissionType || validated?.submissionType },
            req.files
        );
        return sendResponse(
            res,
            201,
            'Delivery partner registered successfully',
            mapDeliveryPartnerRegistrationResponse(partner),
        );
    } catch (error) {
        if (error.statusCode === 409) {
            return res.status(409).json({
                success: false,
                message: error.message,
                errors: error.errors
            });
        }
        next(error);
    }
};

export const updateDeliveryPartnerProfileController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const validated = validateDeliveryProfileUpdateDto(req.body);
        const result = await updateDeliveryPartnerProfile(userId, validated, req.files);
        return sendResponse(
            res,
            200,
            'Profile updated successfully',
            mapDeliveryPartnerProfileCompletionResponse(result),
        );
    } catch (error) {
        if (error.statusCode === 409) {
            return res.status(409).json({
                success: false,
                message: error.message,
                errors: error.errors
            });
        }
        next(error);
    }
};

export const updateDeliveryPartnerDetailsController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const partner = await updateDeliveryPartnerDetails(userId, req.body || {});
        return sendResponse(res, 200, 'Profile updated successfully', { partner });
    } catch (error) {
        next(error);
    }
};

export const updateDeliveryPartnerProfilePhotoBase64Controller = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const partner = await updateDeliveryPartnerProfilePhotoBase64(userId, req.body || {});
        return sendResponse(res, 200, 'Profile photo updated successfully', { partner });
    } catch (error) {
        next(error);
    }
};

export const updateDeliveryPartnerBankDetailsController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const validated = validateDeliveryBankDetailsDto(req.body);
        const partner = await updateDeliveryPartnerBankDetails(userId, validated, req.files);
        const data = {
            bankDetails: {
                accountHolderName: partner.bankAccountHolderName,
                accountNumber: partner.bankAccountNumber,
                ifscCode: partner.bankIfscCode,
                bankName: partner.bankName,
                upiId: partner.upiId,
                upiQrCode: partner.upiQrCode
            },
            panNumber: partner.panNumber
        };
        return sendResponse(res, 200, 'Bank details updated successfully', data);
    } catch (error) {
        if (error.statusCode === 409) {
            return res.status(409).json({
                success: false,
                message: error.message,
                errors: error.errors
            });
        }
        next(error);
    }
};

export const listSupportTicketsController = async (req, res, next) => {
    try {
        const deliveryPartnerId = req.user?.userId;
        const tickets = await listSupportTicketsByPartner(deliveryPartnerId);
        return sendResponse(res, 200, 'Tickets fetched successfully', { tickets });
    } catch (error) {
        next(error);
    }
};

export const createSupportTicketController = async (req, res, next) => {
    try {
        const deliveryPartnerId = req.user?.userId;
        const ticket = await createSupportTicket(deliveryPartnerId, req.body);
        return sendResponse(res, 201, 'Ticket created successfully', ticket);
    } catch (error) {
        next(error);
    }
};

export const getSupportTicketByIdController = async (req, res, next) => {
    try {
        const deliveryPartnerId = req.user?.userId;
        const ticket = await getSupportTicketByIdAndPartner(req.params.id, deliveryPartnerId);
        if (!ticket) {
            return res.status(404).json({ success: false, message: 'Ticket not found' });
        }
        return sendResponse(res, 200, 'Ticket fetched successfully', ticket);
    } catch (error) {
        next(error);
    }
};

export const updateAvailabilityController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const data = await updateDeliveryAvailability(userId, req.body || {});
        return sendResponse(res, 200, 'Availability updated successfully', data);
    } catch (error) {
        next(error);
    }
};

export const getDeliveryPartnerVehiclesController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const data = await getDeliveryPartnerVehicles(userId);
        return sendResponse(res, 200, 'Driver vehicles fetched', data);
    } catch (error) {
        next(error);
    }
};

export const setDeliveryPartnerActiveVehicleController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const vehicleId = req.body?.vehicleId;
        const data = await setDeliveryPartnerActiveVehicle(userId, vehicleId);
        return sendResponse(res, 200, 'Active vehicle updated', data);
    } catch (error) {
        next(error);
    }
};

export const getDriverMapContextController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const data = await getDriverMapContext(userId);
        return sendResponse(res, 200, 'Map context fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const getWalletController = async (req, res, next) => {
    try {
        const deliveryPartnerId = req.user?.userId;
        const requestedTypeRaw = String(req.query?.type || '').trim().toLowerCase();
        const rawLimit = Number.parseInt(String(req.query?.limit || ''), 10);
        const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;

        const normalizeWalletTransaction = (tx) => ({
            ...tx,
            id: tx?.id || tx?._id,
            _id: tx?._id || tx?.id,
            amount: Number(tx?.amount) || 0,
            date: tx?.date || tx?.createdAt,
            createdAt: tx?.createdAt || tx?.date
        });

        if (requestedTypeRaw === 'bonus' || requestedTypeRaw === 'deposit' || requestedTypeRaw === 'withdrawal' || requestedTypeRaw === 'deduction') {
            if (!deliveryPartnerId || !mongoose.Types.ObjectId.isValid(deliveryPartnerId)) {
                return sendResponse(res, 200, 'Wallet fetched successfully', { wallet: { transactions: [] } });
            }

            const wallet = await getDeliveryPartnerWalletEnhanced(deliveryPartnerId);
            
            if (requestedTypeRaw === 'bonus') {
                const bonusList = await DeliveryBonusTransaction.find({ deliveryPartnerId })
                    .sort({ createdAt: -1 })
                    .limit(limit)
                    .lean();

                wallet.transactions = (bonusList || []).map((b) => ({
                    id: b._id,
                    _id: b._id,
                    type: 'bonus',
                    amount: b.amount || 0,
                    status: 'Completed',
                    date: b.createdAt,
                    createdAt: b.createdAt,
                    description: b.reference || 'Bonus',
                    transactionId: b.transactionId
                }));
            } else if (requestedTypeRaw === 'deposit') {
                const partnerObjId = new mongoose.Types.ObjectId(deliveryPartnerId);
                const deposits = await FoodDeliveryCashDeposit.find({ 
                    deliveryPartnerId: partnerObjId,
                    status: { $in: ['Completed', 'Pending', 'Failed'] }
                })
                .sort({ createdAt: -1 })
                .limit(limit)
                .lean();

                wallet.transactions = deposits.map(d => ({
                    id: d._id,
                    _id: d._id,
                    type: 'deposit',
                    amount: d.amount || 0,
                    status: d.status === 'Completed' ? 'Completed' : d.status === 'Failed' ? 'Rejected' : 'Pending',
                    rejectionReason: d.status === 'Failed' ? d.adminNote || 'No reason specified' : '',
                    date: d.createdAt,
                    createdAt: d.createdAt,
                    description: 'Cash limit settlement'
                }));
            } else if (requestedTypeRaw === 'withdrawal') {
                const withdrawals = await mongoose.model('FoodDeliveryWithdrawal').find({ 
                    deliveryPartnerId 
                })
                .sort({ createdAt: -1 })
                .limit(limit)
                .lean();

                wallet.transactions = withdrawals.map(w => ({
                    id: w._id,
                    _id: w._id,
                    type: w.status === 'denied' || w.status === 'rejected' ? 'rejection' : 'withdrawal',
                    amount: w.amount || 0,
                    status: w.status === 'pending' ? 'Pending' : (w.status === 'approved' ? 'Completed' : 'Rejected'),
                    date: w.createdAt,
                    createdAt: w.createdAt,
                    description: `Withdrawal Request - ${w.paymentMethod}`
                }));
            } else if (requestedTypeRaw === 'deduction') {
                // Return both deposits and withdrawals for deduction statement
                const [deposits, withdrawals] = await Promise.all([
                   mongoose.model('FoodDeliveryCashDeposit').find({ deliveryPartnerId, status: 'Completed' }).sort({ createdAt: -1 }).limit(limit).lean(),
                   mongoose.model('FoodDeliveryWithdrawal').find({ deliveryPartnerId }).sort({ createdAt: -1 }).limit(limit).lean()
                ]);

                const txs = [
                   ...deposits.map(d => ({ id: d._id, _id: d._id, type: 'deposit', amount: d.amount, status: d.status, createdAt: d.createdAt, description: 'Limit settlement' })),
                   ...withdrawals.map(w => ({ id: w._id, _id: w._id, type: 'withdrawal', amount: w.amount, status: w.status, createdAt: w.createdAt, description: `Withdrawal - ${w.paymentMethod}` }))
                ].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);

                wallet.transactions = txs;
            }

            const pendingManualDeposit = await FoodDeliveryCashDeposit.findOne({
                deliveryPartnerId: new mongoose.Types.ObjectId(deliveryPartnerId),
                status: 'Pending',
                depositType: { $in: ['admin_bank', 'admin_upi', 'admin_qr', 'zone_hub'] }
            }).lean();

            wallet.pendingManualDeposit = pendingManualDeposit ? {
                id: pendingManualDeposit._id,
                amount: Number(pendingManualDeposit.amount) || 0,
                depositType: pendingManualDeposit.depositType,
                status: pendingManualDeposit.status,
                createdAt: pendingManualDeposit.createdAt
            } : null;

            return sendResponse(res, 200, 'Wallet fetched successfully', { wallet });
        }

        const wallet = await getDeliveryPartnerWalletEnhanced(deliveryPartnerId);

        const pendingManualDeposit = await FoodDeliveryCashDeposit.findOne({
            deliveryPartnerId: new mongoose.Types.ObjectId(deliveryPartnerId),
            status: 'Pending',
            depositType: { $in: ['admin_bank', 'admin_upi', 'admin_qr', 'zone_hub'] }
        }).lean();

        wallet.pendingManualDeposit = pendingManualDeposit ? {
            id: pendingManualDeposit._id,
            amount: Number(pendingManualDeposit.amount) || 0,
            depositType: pendingManualDeposit.depositType,
            status: pendingManualDeposit.status,
            createdAt: pendingManualDeposit.createdAt
        } : null;

        return sendResponse(res, 200, 'Wallet fetched successfully', { wallet });
    } catch (error) {
        next(error);
    }
};

export const createWithdrawalRequestController = async (req, res, next) => {
    try {
        const deliveryPartnerId = req.user?.userId;
        const result = await requestDeliveryWithdrawal(deliveryPartnerId, req.body || {});
        return sendResponse(res, 201, 'Withdrawal request submitted successfully', { withdrawal: result });
    } catch (error) {
        next(error);
    }
};

export const getEarningsController = async (req, res, next) => {
    try {
        const deliveryPartnerId = req.user?.userId;
        const data = await getDeliveryPartnerEarnings(deliveryPartnerId, req.query || {});
        return sendResponse(res, 200, 'Earnings fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const getActiveEarningAddonsController = async (req, res, next) => {
    try {
        const deliveryPartnerId = req.user?.userId;
        const data = await getActiveEarningAddonsForPartner(deliveryPartnerId);
        return sendResponse(res, 200, 'Active earning addons fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const createCashDepositOrderController = async (req, res, next) => {
    try {
        const deliveryPartnerId = req.user?.userId;
        const amount = req.body?.amount;
        const data = await createDeliveryCashDepositOrder(deliveryPartnerId, amount);
        return sendResponse(res, 201, 'Cash deposit order created successfully', data);
    } catch (error) {
        next(error);
    }
};

export const verifyCashDepositPaymentController = async (req, res, next) => {
    try {
        const deliveryPartnerId = req.user?.userId;
        const data = await verifyDeliveryCashDepositPayment(deliveryPartnerId, {
            razorpayOrderId: req.body?.razorpay_order_id,
            razorpayPaymentId: req.body?.razorpay_payment_id,
            razorpaySignature: req.body?.razorpay_signature,
            amount: req.body?.amount
        });
        return sendResponse(res, 200, 'Cash deposit verified successfully', data);
    } catch (error) {
        next(error);
    }
};

export const getTripHistoryController = async (req, res, next) => {
    try {
        const deliveryPartnerId = req.user?.userId;
        const data = await getDeliveryPartnerTripHistory(deliveryPartnerId, req.query || {});
        return sendResponse(res, 200, 'Trip history fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const getPocketDetailsController = async (req, res, next) => {
    try {
        const deliveryPartnerId = req.user?.userId;
        const data = await getDeliveryPocketDetails(deliveryPartnerId, req.query || {});
        return sendResponse(res, 200, 'Pocket details fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const getEmergencyHelpController = async (req, res, next) => {
    try {
        const data = await getDeliveryEmergencyHelp();
        return sendResponse(res, 200, 'Emergency help fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const getCashLimitController = async (req, res, next) => {
    try {
        const data = await getDeliveryCashLimitSettings();
        return sendResponse(res, 200, 'Cash limit fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const getDeliveryReferralStatsController = async (req, res, next) => {
    try {
        const deliveryPartnerId = req.user?.userId;
        const stats = await getDeliveryReferralStats(deliveryPartnerId);
        return sendResponse(res, 200, 'Referral stats fetched successfully', { stats });
    } catch (error) {
        next(error);
    }
};

export const deleteDeliveryPartnerAccountController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const result = await deleteDeliveryPartnerAccount(userId);
        return sendResponse(res, 200, 'Account deleted successfully', result);
    } catch (error) {
        next(error);
    }
};



