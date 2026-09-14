import { OnboardingFeeConfig } from '../models/onboardingFeeConfig.model.js';
import { OnboardingPaymentLog } from '../models/onboardingPaymentLog.model.js';
import { createRazorpayOrder, getRazorpayKeyId, isRazorpayConfigured } from '../../food/orders/helpers/razorpay.helper.js';
import { sendResponse } from '../../../utils/response.js';
import { ValidationError } from '../../../core/auth/errors.js';
import { config } from '../../../config/env.js';
import mongoose from 'mongoose';

// Fetch all active fee configs for frontend onboarding checks
export async function getPublicOnboardingFees(req, res, next) {
    try {
        const configs = await OnboardingFeeConfig.find({ isActive: true }).select('role price isActive').lean();
        
        // Return as key-value mapping or array
        const result = {};
        configs.forEach(c => {
            result[c.role] = {
                price: c.price,
                isActive: c.isActive
            };
        });

        // Ensure default fallback values for roles not configured yet
        ['RESTAURANT', 'SELLER', 'DELIVERY_PARTNER'].forEach(role => {
            if (!result[role]) {
                result[role] = { price: 0, isActive: false };
            }
        });

        return sendResponse(res, 200, 'Onboarding fees configurations fetched successfully', result);
    } catch (error) {
        next(error);
    }
}

// Create a Razorpay Order for Onboarding Payment
export async function createOnboardingPaymentOrder(req, res, next) {
    try {
        const { role, name, phone, email } = req.body;
        const isProduction = String(config.nodeEnv).toLowerCase() === 'production';

        if (!role || !['RESTAURANT', 'SELLER', 'DELIVERY_PARTNER'].includes(role)) {
            throw new ValidationError('Valid role (RESTAURANT, SELLER, DELIVERY_PARTNER) is required');
        }
        if (!name || !name.trim()) {
            throw new ValidationError('Name is required');
        }
        if (!phone || !phone.trim()) {
            throw new ValidationError('Phone is required');
        }

        // Fetch onboarding configuration for price
        const config = await OnboardingFeeConfig.findOne({ role, isActive: true });
        if (!config || config.price <= 0) {
            throw new ValidationError(`No onboarding fee configuration found or active for role: ${role}`);
        }

        // Check if user has already paid in a previous (rejected) application
        const phoneDigits = String(phone).replace(/\D/g, '').slice(-10);
        if (phoneDigits) {
            const existingPayment = await OnboardingPaymentLog.findOne({
                role,
                status: 'success',
                'userDetails.phone': { $regex: new RegExp(phoneDigits + '$') }
            }).sort({ createdAt: -1 });

            if (existingPayment) {
                return sendResponse(res, 201, 'Onboarding fee already paid', {
                    orderId: `already_paid_${Date.now()}`,
                    amount: config.price,
                    currency: 'INR',
                    keyId: getRazorpayKeyId(),
                    isMock: false,
                    alreadyPaid: true
                });
            }
        }

        const price = config.price;
        const amountPaise = Math.round(price * 100);

        let orderId = '';
        if (isRazorpayConfigured()) {
            const receipt = `onb_${role.toLowerCase().slice(0, 3)}_${Date.now()}`;
            const order = await createRazorpayOrder(amountPaise, 'INR', receipt);
            orderId = order.id;
        } else {
            if (isProduction) {
                throw new ValidationError('Onboarding payment provider is unavailable. Please contact support.');
            }
            // Mock order creation for development environments without Razorpay keys
            orderId = `mock_ord_${role.toLowerCase().slice(0, 3)}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        }

        // Create a pending payment log in the database
        await OnboardingPaymentLog.create({
            razorpayOrderId: orderId,
            role,
            amount: price,
            status: 'pending',
            userDetails: {
                name: name.trim(),
                phone: phone.trim(),
                email: (email || '').trim()
            }
        });

        return sendResponse(res, 201, 'Onboarding payment order created successfully', {
            orderId,
            amount: price,
            currency: 'INR',
            keyId: getRazorpayKeyId(),
            isMock: !isRazorpayConfigured() && !isProduction
        });
    } catch (error) {
        next(error);
    }
}

// Admin API: Get all configs (active and inactive)
export async function getOnboardingFeesConfig(req, res, next) {
    try {
        const configs = await OnboardingFeeConfig.find().lean();
        
        // Format to map for easy frontend editing
        const result = {};
        configs.forEach(c => {
            result[c.role] = {
                price: c.price,
                isActive: c.isActive,
                updatedBy: c.updatedBy,
                updatedAt: c.updatedAt
            };
        });

        // Ensure defaults if missing in DB
        ['RESTAURANT', 'SELLER', 'DELIVERY_PARTNER'].forEach(role => {
            if (!result[role]) {
                result[role] = { price: 0, isActive: false };
            }
        });

        return sendResponse(res, 200, 'Onboarding fees configs retrieved', result);
    } catch (error) {
        next(error);
    }
}

// Admin API: Set/Update fee config for a role
export async function updateOnboardingFeeConfig(req, res, next) {
    try {
        const { role } = req.params;
        const { price, isActive } = req.body;

        if (!['RESTAURANT', 'SELLER', 'DELIVERY_PARTNER'].includes(role)) {
            throw new ValidationError('Invalid role');
        }

        if (price !== undefined && (typeof price !== 'number' || price < 0)) {
            throw new ValidationError('Price must be a positive number');
        }

        const adminId = req.user?.userId;
        const adminRole = req.user?.role || 'ADMIN';

        const updateData = {};
        if (price !== undefined) updateData.price = price;
        if (isActive !== undefined) updateData.isActive = !!isActive;
        updateData.updatedBy = {
            adminId: adminId ? new mongoose.Types.ObjectId(adminId) : null,
            role: adminRole,
            at: new Date()
        };

        const config = await OnboardingFeeConfig.findOneAndUpdate(
            { role },
            { $set: updateData },
            { upsert: true, new: true }
        );

        return sendResponse(res, 200, 'Onboarding fee configuration updated successfully', config);
    } catch (error) {
        next(error);
    }
}

// Admin API: Retrieve payment logs with pagination, status filters, search
export async function getOnboardingPayments(req, res, next) {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        const { status, role, search } = req.query;

        const query = {};

        if (status) {
            query.status = status;
        }

        if (role) {
            query.role = role;
        }

        if (search && search.trim()) {
            const searchRegex = new RegExp(search.trim(), 'i');
            query.$or = [
                { 'userDetails.name': searchRegex },
                { 'userDetails.phone': searchRegex },
                { 'userDetails.email': searchRegex },
                { razorpayOrderId: searchRegex },
                { razorpayPaymentId: searchRegex }
            ];
        }

        const [items, total] = await Promise.all([
            OnboardingPaymentLog.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            OnboardingPaymentLog.countDocuments(query)
        ]);

        return sendResponse(res, 200, 'Onboarding payments retrieved successfully', {
            items,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        next(error);
    }
}
