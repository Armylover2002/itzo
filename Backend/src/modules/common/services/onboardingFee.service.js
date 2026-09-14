import { OnboardingFeeConfig } from '../models/onboardingFeeConfig.model.js';
import { OnboardingPaymentLog } from '../models/onboardingPaymentLog.model.js';
import { verifyPaymentSignature } from '../../food/orders/helpers/razorpay.helper.js';
import { ValidationError } from '../../../core/auth/errors.js';
import { config } from '../../../config/env.js';
import mongoose from 'mongoose';

/**
 * Verifies and consumes the onboarding payment for a given role and profile ID.
 * If onboarding fee configuration is inactive or fee is 0, this check is bypassed.
 * 
 * @param {Object} params
 * @param {string} params.role - 'RESTAURANT' | 'SELLER' | 'DELIVERY_PARTNER'
 * @param {Object} params.paymentDetails - { razorpayOrderId, razorpayPaymentId, razorpaySignature }
 * @param {Object} params.userDetails - { name, phone, email }
 * @param {string} params.entityId - Mongoose ObjectId of the created partner profile
 */
export async function verifyAndConsumeOnboardingPayment({ role, paymentDetails = {}, userDetails = {}, entityId = null }) {
    // 1. Check if onboarding fee is active and price is greater than 0
    const config = await OnboardingFeeConfig.findOne({ role });
    if (!config || !config.isActive || config.price <= 0) {
        return { success: true, bypassed: true };
    }

    // 1.5 Check if user has already paid successfully before (e.g. they were rejected and are re-applying)
    if (userDetails && userDetails.phone) {
        const phoneDigits = String(userDetails.phone).replace(/\D/g, '').slice(-10);
        if (phoneDigits) {
            const previousPayment = await OnboardingPaymentLog.findOne({
                role,
                status: 'success',
                'userDetails.phone': { $regex: new RegExp(phoneDigits + '$') }
            }).sort({ createdAt: -1 });

            if (previousPayment) {
                // User already paid in a previous attempt. Bypass payment requirement.
                if (entityId) {
                    previousPayment.entityId = new mongoose.Types.ObjectId(entityId);
                    await previousPayment.save();
                }
                return { success: true, bypassed: true, message: 'Previous successful payment found' };
            }
        }
    }

    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = paymentDetails;
    if (!razorpayOrderId) {
        throw new ValidationError('razorpayOrderId is required for onboarding fee payment');
    }
    if (!razorpayPaymentId) {
        throw new ValidationError('razorpayPaymentId is required for onboarding fee payment');
    }
    if (!razorpaySignature) {
        throw new ValidationError('razorpaySignature is required for onboarding fee payment');
    }

    const isProduction = String(config.nodeEnv).toLowerCase() === 'production';

    // 2. Check if this is a mock order ID
    const isMock = String(razorpayOrderId).startsWith('mock_ord_');
    let isValid = false;

    if (isMock) {
        if (isProduction) {
            throw new ValidationError('Mock onboarding payment IDs are not allowed in production.');
        }
        // Automatically validate mock order IDs only in non-production environments
        isValid = true;
    } else {
        // Validate signature using standard Razorpay helper
        isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    }

    if (!isValid) {
        // Record failed payment attempt
        await OnboardingPaymentLog.findOneAndUpdate(
            { razorpayOrderId },
            {
                $set: {
                    role,
                    status: 'failed',
                    razorpayPaymentId,
                    razorpaySignature,
                    errorDetails: 'Payment signature verification failed.'
                }
            },
            { upsert: true, new: true }
        );
        throw new ValidationError('Onboarding payment verification failed. Invalid signature.');
    }

    const consumedByPaymentId = await OnboardingPaymentLog.findOne({
        razorpayPaymentId,
        status: 'success',
        role,
    }).lean();
    if (consumedByPaymentId && String(consumedByPaymentId.razorpayOrderId || '') !== String(razorpayOrderId)) {
        throw new ValidationError('This payment has already been consumed.');
    }

    const existingLog = await OnboardingPaymentLog.findOne({ razorpayOrderId }).lean();
    if (existingLog?.status === 'success') {
        const existingEntityId = existingLog?.entityId ? String(existingLog.entityId) : '';
        const incomingEntityId = entityId ? String(entityId) : '';
        if (existingEntityId && incomingEntityId && existingEntityId !== incomingEntityId) {
            throw new ValidationError('This onboarding payment has already been consumed.');
        }
        if (existingEntityId && !incomingEntityId) {
            return { success: true, bypassed: false };
        }
    }

    // 3. Mark payment log as successful and associate with created entity (Restaurant, Seller, Delivery Partner)
    await OnboardingPaymentLog.findOneAndUpdate(
        { razorpayOrderId },
        {
            $set: {
                role,
                status: 'success',
                razorpayPaymentId,
                razorpaySignature,
                entityId: entityId ? new mongoose.Types.ObjectId(entityId) : null,
                amount: config.price,
                userDetails: {
                    name: userDetails.name || 'N/A',
                    phone: userDetails.phone || 'N/A',
                    email: userDetails.email || ''
                }
            }
        },
        { upsert: true, new: true }
    );

    return { success: true, bypassed: false };
}
