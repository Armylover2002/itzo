import { sendResponse } from '../../../../utils/response.js';
import { getUserWallet, createWalletTopupOrder, verifyWalletTopupPayment } from '../services/userWallet.service.js';

export const getUserWalletController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const wallet = await getUserWallet(userId);
        return sendResponse(res, 200, 'Wallet fetched successfully', { wallet });
    } catch (error) {
        next(error);
    }
};

export const createWalletTopupOrderController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const amount = req.body?.amount;
        const data = await createWalletTopupOrder(userId, amount);
        return sendResponse(res, 200, 'Top-up order created successfully', data);
    } catch (error) {
        next(error);
    }
};

export const verifyWalletTopupPaymentController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const data = await verifyWalletTopupPayment(userId, req.body || {});
        return sendResponse(res, 200, 'Payment verified successfully', data);
    } catch (error) {
        next(error);
    }
};

