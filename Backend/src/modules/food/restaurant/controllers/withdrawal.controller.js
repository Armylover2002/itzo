import mongoose from 'mongoose';
import { sendResponse, sendError } from '../../../../utils/response.js';
import { FoodRestaurantWithdrawal } from '../models/foodRestaurantWithdrawal.model.js';
import { FoodRestaurantWallet } from '../models/restaurantWallet.model.js';
import { FoodRestaurant } from '../models/restaurant.model.js';
import { getRestaurantAvailableWithdrawalBalance, selfHealRestaurantFinanceLedger } from '../services/restaurantFinance.service.js';
import { getRestaurantWithdrawalLimitSettings } from '../../admin/services/admin.service.js';

function resolveBankDetails(bodyBank, restaurant) {
    const fromBody = bodyBank && typeof bodyBank === 'object' ? bodyBank : {};
    return {
        accountNumber: fromBody.accountNumber || restaurant?.accountNumber || '',
        ifscCode: fromBody.ifscCode || restaurant?.ifscCode || '',
        bankName: fromBody.bankName || restaurant?.bankName || '',
        accountHolderName:
            fromBody.accountHolderName || restaurant?.accountHolderName || '',
    };
}

function hasUsableBankDetails(bank) {
    return Boolean(
        String(bank?.accountNumber || '').trim() &&
            String(bank?.ifscCode || '').trim() &&
            String(bank?.accountHolderName || '').trim()
    );
}

function normalizeIdempotencyKey(value) {
    const key = String(value || '').trim().slice(0, 128);
    return key.length >= 8 ? key : '';
}

function isDuplicateKeyError(error) {
    return (
        error?.code === 11000 ||
        error?.code === 11001 ||
        /E11000|duplicate key/i.test(String(error?.message || ''))
    );
}

async function notifySafely(targets, payload) {
    try {
        const { notifyAdminsSafely } = await import(
            '../../../../core/notifications/firebase.service.js'
        );
        await notifyAdminsSafely(payload);
    } catch (e) {
        console.error('Withdrawal notification failed:', e?.message || e);
    }
}

export const createWithdrawalRequestController = async (req, res, next) => {
    const session = await mongoose.startSession();
    try {
        const restaurantId = req.user?.userId;
        const { amount, bankDetails } = req.body;
        const idempotencyKey = normalizeIdempotencyKey(req.body?.idempotencyKey);

        if (!restaurantId) return sendError(res, 401, 'Restaurant authentication required');
        const numericAmount = Number(amount);
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            return sendError(res, 400, 'Invalid withdrawal amount');
        }

        if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
            return sendError(res, 400, 'Invalid restaurant ID');
        }

        const rid = new mongoose.Types.ObjectId(restaurantId);

        if (idempotencyKey) {
            const existing = await FoodRestaurantWithdrawal.findOne({
                restaurantId: rid,
                idempotencyKey,
            }).lean();
            if (existing) {
                return sendResponse(
                    res,
                    200,
                    'Withdrawal request already submitted',
                    existing
                );
            }
        }

        const [restaurant, limitSettings] = await Promise.all([
            FoodRestaurant.findById(rid)
                .select('restaurantName accountNumber ifscCode bankName accountHolderName')
                .lean(),
            getRestaurantWithdrawalLimitSettings()
        ]);
        if (!restaurant) return sendError(res, 404, 'Restaurant not found');

        const minLimit = Number(limitSettings.restaurantMinWithdrawalLimit) || 1;
        const maxLimit =
            limitSettings.restaurantMaxWithdrawalLimit != null &&
            Number(limitSettings.restaurantMaxWithdrawalLimit) > 0
                ? Number(limitSettings.restaurantMaxWithdrawalLimit)
                : null;

        if (numericAmount < minLimit) {
            return sendError(res, 400, `Minimum withdrawal amount is ₹${minLimit}`);
        }
        if (maxLimit != null && numericAmount > maxLimit) {
            return sendError(res, 400, `Maximum withdrawal amount is ₹${maxLimit}`);
        }

        const resolvedBank = resolveBankDetails(bankDetails, restaurant);
        if (!hasUsableBankDetails(resolvedBank)) {
            return sendError(
                res,
                400,
                'Complete bank account details (account number, IFSC, holder name) before withdrawing'
            );
        }

        let withdrawal;
        let createdNew = false;

        // Heal ledger before balance check / txn (session path skips self-heal).
        await selfHealRestaurantFinanceLedger(restaurantId);

        await session.withTransaction(async () => {
            // Force a write on the wallet row so concurrent creates serialize.
            await FoodRestaurantWallet.findOneAndUpdate(
                { restaurantId: rid },
                {
                    $setOnInsert: { restaurantId: rid },
                    $currentDate: { updatedAt: true },
                },
                { upsert: true, session, new: true }
            );

            // Session-aware ledger balance (pending withdrawals already deducted).
            const { availableBalance } = await getRestaurantAvailableWithdrawalBalance(
                restaurantId,
                { session }
            );
            const balance = Number(availableBalance) || 0;
            const effectiveMax =
                maxLimit != null ? Math.min(balance, maxLimit) : balance;

            if (numericAmount > balance) {
                const err = new Error(
                    `Insufficient balance. Available: ₹${balance}`
                );
                err.statusCode = 400;
                throw err;
            }
            if (numericAmount > effectiveMax) {
                const err = new Error(
                    `You can withdraw maximum ₹${effectiveMax} in one request`
                );
                err.statusCode = 400;
                throw err;
            }

            if (idempotencyKey) {
                const existingInTxn = await FoodRestaurantWithdrawal.findOne({
                    restaurantId: rid,
                    idempotencyKey,
                })
                    .session(session)
                    .lean();
                if (existingInTxn) {
                    withdrawal = existingInTxn;
                    return;
                }
            }

            const payload = {
                restaurantId: rid,
                amount: numericAmount,
                bankDetails: resolvedBank,
                status: 'pending',
            };
            if (idempotencyKey) payload.idempotencyKey = idempotencyKey;

            try {
                const [created] = await FoodRestaurantWithdrawal.create([payload], {
                    session,
                });
                withdrawal = created;
                createdNew = true;
            } catch (createErr) {
                if (idempotencyKey && isDuplicateKeyError(createErr)) {
                    const existingDup = await FoodRestaurantWithdrawal.findOne({
                        restaurantId: rid,
                        idempotencyKey,
                    })
                        .session(session)
                        .lean();
                    if (existingDup) {
                        withdrawal = existingDup;
                        return;
                    }
                }
                throw createErr;
            }
        });

        if (createdNew && withdrawal) {
            await notifySafely(
                [],
                {
                    title: 'New withdrawal request',
                    body: `${restaurant.restaurantName || 'Restaurant'} requested ₹${Number(numericAmount).toFixed(2)}`,
                    data: {
                        type: 'withdraw_request',
                        withdrawalId: String(withdrawal._id),
                        restaurantId: String(rid),
                    },
                }
            );
        }

        return sendResponse(
            res,
            createdNew ? 201 : 200,
            createdNew
                ? 'Withdrawal request submitted successfully'
                : 'Withdrawal request already submitted',
            withdrawal
        );
    } catch (error) {
        if (
            error?.statusCode === 400 ||
            /Insufficient balance|Minimum withdrawal|Maximum withdrawal/i.test(error?.message || '')
        ) {
            return sendError(res, 400, error.message);
        }
        next(error);
    } finally {
        session.endSession();
    }
};

export const listMyWithdrawalsController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        if (!restaurantId) return sendError(res, 401, 'Restaurant authentication required');

        const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
        const rawLimit = parseInt(String(req.query.limit || '50'), 10) || 50;
        const limit = Math.min(100, Math.max(1, rawLimit));
        const skip = (page - 1) * limit;

        const ALLOWED_STATUSES = new Set([
            'pending',
            'processing',
            'approved',
            'rejected',
            'cancelled',
        ]);
        const statusParam = String(req.query.status || '')
            .trim()
            .toLowerCase();
        const statuses = statusParam
            ? statusParam
                  .split(',')
                  .map((s) => s.trim())
                  .filter((s) => ALLOWED_STATUSES.has(s))
            : [];

        const filter = { restaurantId };
        if (statuses.length === 1) {
            filter.status = statuses[0];
        } else if (statuses.length > 1) {
            filter.status = { $in: statuses };
        }

        const [withdrawals, total] = await Promise.all([
            FoodRestaurantWithdrawal.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            FoodRestaurantWithdrawal.countDocuments(filter),
        ]);

        return sendResponse(res, 200, 'Withdrawals fetched successfully', {
            withdrawals,
            total,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil(total / limit) || 1),
        });
    } catch (error) {
        next(error);
    }
};

/** Cancel a pending withdrawal — releases the soft lock on available balance */
export const cancelMyWithdrawalController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const { id } = req.params;
        if (!restaurantId) return sendError(res, 401, 'Restaurant authentication required');
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return sendError(res, 400, 'Invalid withdrawal ID');
        }

        const cancelled = await FoodRestaurantWithdrawal.findOneAndUpdate(
            {
                _id: id,
                restaurantId,
                status: 'pending',
            },
            {
                $set: {
                    status: 'cancelled',
                    rejectionReason: 'Cancelled by restaurant',
                    processedAt: new Date(),
                },
            },
            { new: true }
        ).lean();

        if (!cancelled) {
            return sendError(res, 400, 'Only pending withdrawals can be cancelled');
        }

        return sendResponse(res, 200, 'Withdrawal cancelled successfully', cancelled);
    } catch (error) {
        next(error);
    }
};
