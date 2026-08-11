import mongoose from 'mongoose';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import { FoodDailyPass } from '../models/foodDailyPass.model.js';
import { FoodWalletLedger } from '../models/foodWalletLedger.model.js';
import { FoodDeliveryWallet } from '../../delivery/models/deliveryWallet.model.js';
import { FoodRestaurantWallet } from '../../restaurant/models/restaurantWallet.model.js';
import { getActiveSubscription } from './subscription.service.js';
import { SubscriptionPlan } from '../../admin/models/subscriptionPlan.model.js';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import { createRazorpayOrder, isRazorpayConfigured, getRazorpayKeyId } from '../../orders/helpers/razorpay.helper.js';
import { logger } from '../../../../utils/logger.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const IST_TIMEZONE = 'Asia/Kolkata';

import http from 'http';

function reportDebug(event, data) {
    const payload = JSON.stringify({
        sessionId: 'topup-500-crash',
        runId: 'pre',
        timestamp: new Date().toISOString(),
        event,
        data
    });
    const req = http.request('http://127.0.0.1:7778/event', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    });
    req.on('error', () => {});
    req.write(payload);
    req.end();
}

/**
 * Creates a Razorpay order for subscription wallet top-up.
 */
export async function createTopupOrder(userId, userType, amount) {
    if (!amount || amount < 1) throw new ValidationError('Minimum topup amount is ₹1');
    if (!['RESTAURANT', 'DELIVERY_PARTNER'].includes(userType)) throw new ValidationError('Invalid user type');

    // PHASE 1: Minimum balance enforcement
    const MIN_BALANCE = 1000;
    const WalletModel = userType === 'RESTAURANT' ? FoodRestaurantWallet : FoodDeliveryWallet;
    const ownerFilter = userType === 'RESTAURANT' ? { restaurantId: userId } : { deliveryPartnerId: userId };

    const wallet = await WalletModel.findOne(ownerFilter).select('subscriptionBalance').lean();
    const currentBalance = wallet?.subscriptionBalance || 0;

    if (currentBalance < MIN_BALANCE) {
        const requiredTopup = Math.max(0, MIN_BALANCE - currentBalance);
        if (amount < requiredTopup) {
            throw new ValidationError(`Minimum recharge required is ₹${requiredTopup} to maintain active status`);
        }
    }

    const amountPaise = Math.round(amount * 100);
    const receipt = `tp_${String(userId).slice(-6)}_${Date.now().toString().slice(-6)}`;

    const notes = {
        type: 'subscription_wallet_topup',
        ownerId: String(userId),
        ownerType: userType,
        amount: String(amount)
    };

    if (!isRazorpayConfigured()) {
        // #region debug-point trace-razorpay-unconfigured
        reportDebug('razorpay-not-configured', { userId, userType, amount });
        // #endregion
        return {
            razorpay: {
                key: getRazorpayKeyId() || 'rzp_test_dummy',
                order_id: `order_dev_${Date.now()}`,
                amount: amountPaise,
                currency: 'INR',
                notes
            }
        };
    }

    try {
        const order = await createRazorpayOrder(amountPaise, 'INR', receipt, notes);
        return {
            razorpay: {
                key: getRazorpayKeyId(),
                order_id: String(order.id),
                amount: Number(order.amount),
                currency: order.currency || 'INR',
                notes
            }
        };
    } catch (error) {
        throw error;
    }
}

/**
 * Verifies the Razorpay payment and increments subscription balance.
 * This is the SOURCE OF TRUTH called by the Razorpay Webhook.
 */
export async function verifyTopup(payload) {
    const { payment, order, notes } = payload;
    const rzPaymentId = payment.id;
    const { ownerId, ownerType, amount } = notes;

    if (!ownerId || !ownerType || !amount) {
        logger.error('verifyTopup: Missing mandatory notes in Razorpay payload', { notes });
        return;
    }

    const topupAmount = Number(amount);
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Check if already processed (Idempotency via Ledger)
        const existingLedger = await FoodWalletLedger.findOne({ 
            referenceId: rzPaymentId, 
            type: 'TOPUP' 
        }).session(session);

        if (existingLedger) {
            logger.info(`verifyTopup: Topup already processed for payment ${rzPaymentId}`);
            await session.commitTransaction();
            return;
        }

        // 2. Update Wallet Balance Atomically using $inc with UPSERT for first-time users
        const WalletModel = ownerType === 'RESTAURANT' ? FoodRestaurantWallet : FoodDeliveryWallet;
        const ownerFilter = ownerType === 'RESTAURANT' ? { restaurantId: ownerId } : { deliveryPartnerId: ownerId };

        const wallet = await WalletModel.findOneAndUpdate(
            ownerFilter,
            { $inc: { subscriptionBalance: topupAmount } },
            { session, new: false, upsert: true, setDefaultsOnInsert: true } // Get state BEFORE increment for ledger
        );

        // If upsert happened, wallet will be null with new:false
        const beforeBalance = wallet ? (wallet.subscriptionBalance || 0) : 0;
        const afterBalance = beforeBalance + topupAmount;

        // 3. Create Ledger Entry
        await FoodWalletLedger.create([{
            ownerId,
            ownerType,
            type: 'TOPUP',
            amount: topupAmount,
            beforeBalance,
            afterBalance,
            referenceId: rzPaymentId,
            metadata: { razorpayOrderId: order?.id, razorpayPaymentId: rzPaymentId }
        }], { session });

        await session.commitTransaction();
        logger.info(`verifyTopup: Successfully credited ₹${topupAmount} to ${ownerType} ${ownerId}`);
    } catch (error) {
        await session.abortTransaction();
        logger.error('verifyTopup: Transaction failed', { error: error.message, ownerId, rzPaymentId });
        throw error;
    } finally {
        session.endSession();
    }
}

/**
 * Structured logger for critical daily pass lifecycle events.
 */
function logDailyPassEvent(event, { userId, userType, retryCount = 0, passId = null, walletBefore = null, walletAfter = null, extra = {} }) {
    logger.info({
        message: `DAILY_PASS_LOG: ${event}`,
        event,
        userId,
        userType,
        retryCount,
        passId,
        walletBefore,
        walletAfter,
        timestamp: new Date().toISOString(),
        ...extra
    });
}

/**
 * Activates a daily pass by deducting the fee from the subscription wallet.
 * Saga-like flow: Pass Lock -> Wallet Deduct -> Ledger Create.
 * Robust standalone rollback safety, race-condition delay, and exact deletion checks.
 */
export async function activateDailyPass(userId, userType, retryCount = 0) {
    const todayIST = dayjs().tz(IST_TIMEZONE).format('YYYY-MM-DD');
    const endOfDayIST = dayjs().tz(IST_TIMEZONE).endOf('day').toDate();

    // 1. Recurring Plan Guard (MONTH/WEEK)
    const activeSub = await getActiveSubscription(userId, userType);
    if (activeSub && activeSub.planId) {
        logDailyPassEvent('RECURRING_PLAN_BYPASS', { userId, userType, retryCount });
        return {
            success: true,
            deducted: false,
            reason: 'RECURRING_ACTIVE'
        };
    }

    // 2. Fetch Dynamic Plan Price
    const dayPlan = await SubscriptionPlan.findOne({ 
        durationUnit: 'DAY', 
        userType, 
        isActive: true, 
        isDeleted: false 
    }).lean();

    if (!dayPlan) {
        return { success: false, deducted: false, reason: 'PLAN_NOT_FOUND' };
    }
    const deductionAmount = dayPlan.price;

    let newPass;
    try {
        // Step 1 of Saga: Insert Daily Pass (Primary lock)
        [newPass] = await FoodDailyPass.create([{
            userId,
            userType,
            date: todayIST,
            amountDeducted: deductionAmount,
            expiresAt: endOfDayIST
        }]);
        logDailyPassEvent('PASS_INSERT_SUCCESS', { userId, userType, retryCount, passId: String(newPass._id) });
    } catch (err) {
        if (err.code === 11000) {
            logDailyPassEvent('PASS_DUPLICATE_KEY', { userId, userType, retryCount });
            
            // Step 2: Bounded Polling Loop for Ledger Verification
            let ledgerExists = null;
            let existingPass = null;
            const delays = [0, 100, 150]; // 0ms (immediate check), 100ms, 150ms
            
            for (let i = 0; i < delays.length; i++) {
                if (delays[i] > 0) {
                    await new Promise(resolve => setTimeout(resolve, delays[i]));
                }
                
                existingPass = await FoodDailyPass.findOne({ userId, userType, date: todayIST }).lean();
                if (existingPass) {
                    ledgerExists = await FoodWalletLedger.findOne({
                        ownerId: userId,
                        ownerType: userType,
                        type: 'DAILY_DEDUCTION',
                        referenceId: String(existingPass._id)
                    }).lean();
                    if (ledgerExists) {
                        break;
                    }
                }
            }

            if (ledgerExists) {
                logDailyPassEvent('PASS_LEDGER_FOUND', { userId, userType, retryCount, passId: String(existingPass._id) });
                logDailyPassEvent('PASS_ALREADY_ACTIVE', { userId, userType, retryCount, passId: String(existingPass._id) });
                return {
                    success: true,
                    deducted: false,
                    reason: 'PASS_ALREADY_ACTIVE',
                    expiresAt: existingPass.expiresAt,
                    amountDeducted: existingPass.amountDeducted
                };
            }

            // Ledger missing after polling -> Corrupted Pass State detected
            logDailyPassEvent('PASS_LEDGER_MISSING', { userId, userType, retryCount, passId: existingPass ? String(existingPass._id) : null });
            
            if (existingPass) {
                // Delete precisely by unique record ID
                await FoodDailyPass.deleteOne({ _id: existingPass._id });
                logDailyPassEvent('PASS_CORRUPTED_DELETED', { userId, userType, retryCount, passId: String(existingPass._id) });
            }

            if (retryCount < 1) {
                logDailyPassEvent('PASS_RETRY_STARTED', { userId, userType, retryCount });
                return activateDailyPass(userId, userType, retryCount + 1);
            } else {
                logDailyPassEvent('PASS_RETRY_FAILED', { userId, userType, retryCount });
                throw new ValidationError('Activation conflict detected. Please retry.');
            }
        }
        throw err;
    }

    // Step 2 of Saga: Deduct Wallet Balance
    const WalletModel = userType === 'RESTAURANT' ? FoodRestaurantWallet : FoodDeliveryWallet;
    const ownerFilter = userType === 'RESTAURANT' ? { restaurantId: userId } : { deliveryPartnerId: userId };
    const safetyThreshold = Math.max(1000, deductionAmount);

    let wallet;
    try {
        wallet = await WalletModel.findOneAndUpdate(
            { ...ownerFilter, subscriptionBalance: { $gte: safetyThreshold } },
            { $inc: { subscriptionBalance: -deductionAmount } },
            { new: false } // Get state BEFORE decrement
        );
    } catch (deductionErr) {
        logDailyPassEvent('WALLET_DEDUCTION_FAILED', { userId, userType, retryCount, passId: String(newPass._id), extra: { error: deductionErr.message } });
        // Compensating Rollback: Delete Pass
        await FoodDailyPass.deleteOne({ _id: newPass._id });
        logDailyPassEvent('PASS_CORRUPTED_DELETED', { userId, userType, retryCount, passId: String(newPass._id), extra: { context: 'rollback_due_to_db_error' } });
        throw deductionErr;
    }

    if (!wallet) {
        logDailyPassEvent('WALLET_DEDUCTION_FAILED', { userId, userType, retryCount, passId: String(newPass._id), extra: { reason: 'LOW_BALANCE' } });
        // Compensating Rollback: Delete Pass
        await FoodDailyPass.deleteOne({ _id: newPass._id });
        logDailyPassEvent('PASS_CORRUPTED_DELETED', { userId, userType, retryCount, passId: String(newPass._id), extra: { context: 'rollback_due_to_low_balance' } });
        return { success: false, deducted: false, reason: 'LOW_BALANCE' };
    }

    const beforeBalance = wallet.subscriptionBalance;
    const afterBalance = beforeBalance - deductionAmount;
    logDailyPassEvent('WALLET_DEDUCTION_SUCCESS', { userId, userType, retryCount, passId: String(newPass._id), walletBefore: beforeBalance, walletAfter: afterBalance });

    // Step 3 of Saga: Create Ledger Entry
    try {
        await FoodWalletLedger.create([{
            ownerId: userId,
            ownerType: userType,
            type: 'DAILY_DEDUCTION',
            amount: deductionAmount,
            beforeBalance,
            afterBalance,
            referenceId: String(newPass._id),
            metadata: { planId: dayPlan._id, date: todayIST }
        }]);
        logDailyPassEvent('LEDGER_CREATE_SUCCESS', { userId, userType, retryCount, passId: String(newPass._id), walletBefore: beforeBalance, walletAfter: afterBalance });
    } catch (ledgerErr) {
        // Self-Healing Strategy: Log ledger failure but keep pass active to prevent double-charging loop
        logDailyPassEvent('LEDGER_CREATE_FAILED', { userId, userType, retryCount, passId: String(newPass._id), walletBefore: beforeBalance, walletAfter: afterBalance, extra: { error: ledgerErr.message } });
    }

    return {
        success: true,
        deducted: true,
        reason: 'DAY_PASS_ACTIVATED',
        expiresAt: endOfDayIST,
        amountDeducted: deductionAmount
    };
}

export async function ensureDailyPassEligibility(userId, userType) {
    if (!['RESTAURANT', 'DELIVERY_PARTNER'].includes(userType)) {
        throw new ValidationError('Invalid user type for eligibility check');
    }

    // 1. Priority Check: MONTH/WEEK Subscription (MONTH > WEEK)
    const activeSub = await getActiveSubscription(userId, userType);
    if (activeSub && activeSub.planId) {
        const interval = activeSub.planId.interval; // Expected 'month' or 'week'
        const type = interval === 'month' ? 'MONTH' : 'WEEK';
        logDailyPassEvent('RECURRING_PLAN_BYPASS', { userId, userType });
        return {
            eligible: true,
            reason: 'RECURRING_ACTIVE',
            shouldDeduct: false,
            subscriptionType: type
        };
    }

    // 2. Priority Check: DAY PASS (Already active for today IST and NOT EXPIRED)
    const todayIST = dayjs().tz(IST_TIMEZONE).format('YYYY-MM-DD');
    console.log("[TRACE] ensureDailyPassEligibility starting", { userId, userType, todayIST });
    
    let existingPass = await FoodDailyPass.findOne({
        userId,
        userType,
        date: todayIST,
        expiresAt: { $gt: new Date() } // Hotfix verify pass is active
    }).lean();

    if (existingPass) {
        // Real-time self-healing check: Verify matching ledger entry exists
        const ledgerExists = await FoodWalletLedger.findOne({
            ownerId: userId,
            ownerType: userType,
            type: 'DAILY_DEDUCTION',
            referenceId: String(existingPass._id)
        }).lean();

        if (ledgerExists) {
            logDailyPassEvent('PASS_ALREADY_ACTIVE', { userId, userType, passId: String(existingPass._id) });
            return {
                eligible: true,
                reason: 'DAY_PASS_ACTIVE',
                shouldDeduct: false,
                subscriptionType: 'DAY'
            };
        } else {
            // Corrupted pass detected (pass exists but no ledger)
            logDailyPassEvent('PASS_LEDGER_MISSING', { userId, userType, passId: String(existingPass._id), extra: { context: 'eligibility_check' } });
            await FoodDailyPass.deleteOne({ _id: existingPass._id });
            logDailyPassEvent('PASS_CORRUPTED_DELETED', { userId, userType, passId: String(existingPass._id), extra: { context: 'eligibility_check' } });
            existingPass = null; // Mark null so it falls through to balance check
        }
    }

    // 3. Balance Check: Check if deduction is possible (Min ₹1000)
    const WalletModel = userType === 'RESTAURANT' ? FoodRestaurantWallet : FoodDeliveryWallet;
    const ownerFilter = userType === 'RESTAURANT' ? { restaurantId: userId } : { deliveryPartnerId: userId };
    
    const wallet = await WalletModel.findOne(ownerFilter).select('subscriptionBalance').lean();
    const balance = wallet?.subscriptionBalance || 0;
    
    // Fetch deduction amount for UI feedback
    const dayPlan = await SubscriptionPlan.findOne({ 
        durationUnit: 'DAY', 
        userType, 
        isActive: true, 
        isDeleted: false 
    }).select('price').lean();
    const deductionAmount = dayPlan?.price || 0;

    console.log("[TRACE] Step 3 Balance Check:", { balance, minRequired: 1000, deductionAmount });

    if (balance < 1000) {
        return {
            eligible: false,
            reason: 'LOW_BALANCE',
            shouldDeduct: false,
            subscriptionType: null,
            balance,
            threshold: 1000,
            deductionAmount
        };
    }

    // 4. Decision: Eligible but requires deduction
    return {
        eligible: true,
        reason: 'REQUIRES_DAY_DEDUCTION',
        shouldDeduct: true,
        subscriptionType: 'DAY',
        balance,
        threshold: 1000,
        deductionAmount
    };
}
export async function getWalletLedger(ownerId, ownerType, { limit = 20, skip = 0 } = {}) {
    if (!['RESTAURANT', 'DELIVERY_PARTNER'].includes(ownerType)) throw new ValidationError('Invalid owner type');
    
    const query = { ownerId, ownerType };
    const history = await FoodWalletLedger.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    const total = await FoodWalletLedger.countDocuments(query);
    
    return {
        history,
        pagination: {
            total,
            limit,
            skip
        }
    };
}

/**
 * A strictly read-only check of a restaurant's or delivery partner's operational status.
 * Contains ZERO side effects (no logs, no deletions, no mutations) and avoids wallet query.
 * Used exclusively during profile/login hydration to derive online status.
 */
export async function checkRestaurantEligibilityReadOnly(userId, userType) {
    if (!['RESTAURANT', 'DELIVERY_PARTNER'].includes(userType)) {
        return { eligible: false, shouldDeduct: false, shouldAppearOnline: false, reason: 'INVALID_USER_TYPE' };
    }

    // 1. Check Recurring Subscription (Month/Week)
    const activeSub = await getActiveSubscription(userId, userType);
    if (activeSub && activeSub.planId) {
        const interval = activeSub.planId.interval;
        const type = interval === 'month' ? 'MONTH' : 'WEEK';
        return {
            eligible: true,
            shouldDeduct: false,
            shouldAppearOnline: true,
            reason: 'RECURRING_ACTIVE',
            subscriptionType: type
        };
    }

    // 2. Check Daily Pass (Valid for today and matching ledger exists)
    const todayIST = dayjs().tz(IST_TIMEZONE).format('YYYY-MM-DD');
    const existingPass = await FoodDailyPass.findOne({
        userId,
        userType,
        date: todayIST,
        expiresAt: { $gt: new Date() }
    }).lean();

    if (existingPass) {
        // Confirm matching ledger exists (strict verification)
        const ledgerExists = await FoodWalletLedger.findOne({
            ownerId: userId,
            ownerType: userType,
            type: 'DAILY_DEDUCTION',
            referenceId: String(existingPass._id)
        }).lean();

        if (ledgerExists) {
            return {
                eligible: true,
                shouldDeduct: false,
                shouldAppearOnline: true,
                reason: 'DAY_PASS_ACTIVE',
                subscriptionType: 'DAY'
            };
        }
    }

    // 3. Fallback: No active recurring plan and no valid day pass today
    return {
        eligible: false,
        shouldDeduct: true,
        shouldAppearOnline: false,
        reason: 'REQUIRES_DAY_DEDUCTION',
        subscriptionType: 'DAY'
    };
}

