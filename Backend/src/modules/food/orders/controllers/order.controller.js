import { sendResponse } from '../../../../utils/response.js';
import * as orderService from '../services/order.service.js';
import * as foodOrderPaymentService from '../services/foodOrderPayment.service.js';
import {
    validateCalculateOrderDto,
    validateCreateOrderDto,
    validateVerifyPaymentDto,
    validateCancelOrderDto,
    validateOrderStatusDto,
    validateAdminOrderStatusDto,
    validateAssignDeliveryDto,
    validateDispatchSettingsDto,
    validateOrderRatingsDto
} from '../validators/order.validator.js';
import {
    toOrderMutationAck,
    toOrderCreateDto,
    toOrderListItemDto,
    toOrderDetailDto,
    toDeliveryTripDto,
    toRestaurantOrderListDto,
    toUserOrderListDto,
} from '../dto/order.dto.js';

function mapListResult(result, role) {
    if (!result) return result;
    const docs = Array.isArray(result.data)
        ? result.data.map((doc) => toOrderListItemDto(doc, { role }))
        : result.data;
    const orders = Array.isArray(result.orders)
        ? result.orders.map((doc) => toOrderListItemDto(doc, { role }))
        : docs;
    return {
        ...result,
        data: docs,
        ...(result.orders ? { orders } : {}),
    };
}

function mapRestaurantOrderListResult(result) {
    if (!result) return result;
    const docs = Array.isArray(result.data)
        ? result.data.map((doc) => toRestaurantOrderListDto(doc))
        : result.data;
    return {
        ...result,
        data: docs,
    };
}

function mapUserOrderListResult(result) {
    if (!result) return result;
    const docs = Array.isArray(result.data)
        ? result.data.map((doc) => toUserOrderListDto(doc))
        : result.data;
    return {
        ...result,
        data: docs,
    };
}

/** Public calculate payload — never leak full zone geometry / internal fee docs. */
function toPublicCalculateResult(result) {
    const zone = result?.serviceZone?.zone;
    return {
        pricing: result?.pricing ?? null,
        serviceZone: result?.serviceZone
            ? {
                  zoneId: result.serviceZone.zoneId,
                  status: result.serviceZone.status,
                  zone: zone
                      ? {
                            _id: zone._id,
                            name: zone.name || zone.zoneName || null,
                            zoneName: zone.zoneName || zone.name || null,
                            isActive: zone.isActive,
                            quickDeliveryEnabled: zone.quickDeliveryEnabled,
                        }
                      : null,
              }
            : null,
    };
}

export async function calculateOrderController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const dto = validateCalculateOrderDto(req.body);
        const result = await orderService.calculateOrder(userId, dto);
        // Strip internal-only fields from HTTP response (createOrder still uses full result in-process).
        const { feeSettingsDoc, serviceZone, pricing, ...publicResult } = result || {};

        // Optimize pricing payload to remove internal finance and dispatch rules
        const {
            userDeliveryFee,
            restaurantDeliveryFee,
            sponsoredDelivery,
            sponsoredKm,
            deliverySponsorType,
            quickPlatformShare,
            quickRiderBonus,
            quickRiderShare,
            quickRestaurantShare,
            quickSharePcts,
            quickFinanceVersion,
            pickupPoints,
            mixedOrderDistanceLimit,
            mixedOrderAngleLimit,
            sameDirection,
            ...publicPricing
        } = pricing || {};

        const publicZone = serviceZone
            ? { zoneId: serviceZone.zoneId, status: serviceZone.status }
            : null;

        return sendResponse(res, 200, 'Pricing calculated', {
            ...publicResult,
            pricing: publicPricing,
            serviceZone: publicZone,
        });
        // feeSettingsDoc + full zone polygon stay internal (createOrder reuse only).
        return sendResponse(res, 200, 'Pricing calculated', toPublicCalculateResult(result));
    } catch (err) {
        next(err);
    }
}

export async function createOrderController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const dto = validateCreateOrderDto(req.body);
        const result = await orderService.createOrder(userId, dto);
        return sendResponse(res, 201, 'Order placed successfully', {
            ...result,
            order: toOrderCreateDto(result?.order),
        });
    } catch (err) {
        next(err);
    }
}

export async function verifyPaymentController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const dto = validateVerifyPaymentDto(req.body);
        const result = await orderService.verifyPayment(userId, dto);
        return sendResponse(res, 200, 'Payment verified', {
            ...result,
            order: toOrderCreateDto(result?.order),
        });
    } catch (err) {
        next(err);
    }
}

export async function listOrdersUserController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const result = await orderService.listOrdersUser(userId, req.query);
        return sendResponse(res, 200, 'Orders retrieved', mapUserOrderListResult(result));
    } catch (err) {
        next(err);
    }
}

export async function getOrderByIdUserController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const orderId = req.params.orderId;
        const order = await orderService.getOrderById(orderId, { userId });
        return sendResponse(res, 200, 'Order retrieved', {
            order: toOrderDetailDto(order, { role: 'USER' }),
        });
    } catch (err) {
        next(err);
    }
}

export async function getOrderDropOtpUserController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const orderId = req.params.orderId;
        const result = await orderService.getDropOtpUser(orderId, userId);
        return sendResponse(res, 200, 'Drop OTP retrieved', result);
    } catch (err) {
        next(err);
    }
}

/** Ledger rows from `food_order_payments` (append-only audit trail) */
export async function getOrderPaymentsUserController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const orderId = req.params.orderId;
        const result = await foodOrderPaymentService.listFoodOrderPaymentsForUser(orderId, userId);
        return sendResponse(res, 200, 'Payment history', result);
    } catch (err) {
        next(err);
    }
}

export async function cancelOrderController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const orderId = req.params.orderId;
        const dto = validateCancelOrderDto(req.body);
        const order = await orderService.cancelOrder(orderId, userId, dto.reason, dto.refundTo);
        return sendResponse(res, 200, 'Order cancelled', {
            order: toOrderMutationAck(order),
        });
    } catch (err) {
        next(err);
    }
}

export async function submitOrderRatingsController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const orderId = req.params.orderId;
        const dto = validateOrderRatingsDto(req.body);
        const order = await orderService.submitOrderRatings(orderId, userId, dto);
        return sendResponse(res, 200, 'Ratings submitted successfully', {
            order: toOrderMutationAck(order),
        });
    } catch (err) {
        next(err);
    }
}

export async function updateOrderInstructionsController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const orderId = req.params.orderId;
        const instructions = req.body.instructions;
        const order = await orderService.updateOrderInstructions(orderId, userId, instructions);
        return sendResponse(res, 200, 'Instructions updated successfully', {
            order: toOrderMutationAck(order),
        });
    } catch (err) {
        next(err);
    }
}

export async function getDispatchSettingsController(req, res, next) {
    try {
        const result = await orderService.getDispatchSettings();
        return sendResponse(res, 200, 'Dispatch settings retrieved', result);
    } catch (err) {
        next(err);
    }
}

export async function updateDispatchSettingsController(req, res, next) {
    try {
        const adminId = req.user?.userId;
        const dto = validateDispatchSettingsDto(req.body);
        const result = await orderService.updateDispatchSettings(dto.dispatchMode, adminId);
        return sendResponse(res, 200, 'Dispatch settings updated', result);
    } catch (err) {
        next(err);
    }
}

export async function listOrdersRestaurantController(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        const result = await orderService.listOrdersRestaurant(restaurantId, req.query);
        return sendResponse(res, 200, 'Orders retrieved', mapRestaurantOrderListResult(result));
    } catch (err) {
        next(err);
    }
}

export async function getOrderByIdRestaurantController(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        const orderId = req.params.orderId;
        const order = await orderService.getOrderById(orderId, { restaurantId });
        return sendResponse(res, 200, 'Order retrieved', {
            order: toOrderDetailDto(order, { role: 'RESTAURANT' }),
        });
    } catch (err) {
        next(err);
    }
}

export async function updateOrderStatusRestaurantController(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        const orderId = req.params.orderId;
        const dto = validateOrderStatusDto(req.body);
        const order = await orderService.updateOrderStatusRestaurant(
            orderId,
            restaurantId,
            dto.orderStatus,
            dto.reason || "",
            {
                prepTimeMins: dto.prepTimeMins,
                preparationTime: dto.preparationTime,
            },
        );
        return sendResponse(res, 200, 'Order status updated', {
            order: toOrderMutationAck(order),
        });
    } catch (err) {
        next(err);
    }
}

export async function listOrdersAvailableDeliveryController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const result = await orderService.listOrdersAvailableDelivery(deliveryPartnerId, req.query);
        const data = Array.isArray(result?.data)
            ? result.data.map((doc) => toDeliveryTripDto(doc))
            : result?.data;
        const orders = Array.isArray(result?.orders)
            ? result.orders.map((doc) => toDeliveryTripDto(doc))
            : data;
        return sendResponse(res, 200, 'Orders retrieved', {
            ...result,
            data,
            ...(result?.orders ? { orders } : {}),
        });
    } catch (err) {
        next(err);
    }
}

export async function acceptOrderDeliveryController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const orderId = req.params.orderId;
        const order = await orderService.acceptOrderDelivery(orderId, deliveryPartnerId, req.body || {});
        return sendResponse(res, 200, 'Order accepted', {
            order: toDeliveryTripDto(order),
        });
    } catch (err) {
        next(err);
    }
}

export async function rejectOrderDeliveryController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const orderId = req.params.orderId;
        const order = await orderService.rejectOrderDelivery(orderId, deliveryPartnerId, req.body || {});
        return sendResponse(res, 200, 'Order rejected', {
            order: toOrderMutationAck(order),
        });
    } catch (err) {
        next(err);
    }
}

export async function confirmReachedPickupDeliveryController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const orderId = req.params.orderId;
        const order = await orderService.confirmReachedPickupDelivery(orderId, deliveryPartnerId);
        return sendResponse(res, 200, 'Reached pickup confirmed', {
            order: toOrderMutationAck(order),
        });
    } catch (err) {
        next(err);
    }
}

export async function confirmPickupDeliveryController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const orderId = req.params.orderId;
        const { billImageUrl, ...rest } = req.body || {};
        const order = await orderService.confirmPickupDelivery(orderId, deliveryPartnerId, billImageUrl, rest);
        return sendResponse(res, 200, 'Pickup confirmed', {
            order: toDeliveryTripDto(order),
        });
    } catch (err) {
        next(err);
    }
}

export async function confirmReachedDropDeliveryController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const orderId = req.params.orderId;
        const order = await orderService.confirmReachedDropDelivery(orderId, deliveryPartnerId, req.body || {});
        return sendResponse(res, 200, 'Reached drop confirmed', {
            order: toOrderMutationAck(order),
        });
    } catch (err) {
        next(err);
    }
}

export async function verifyDropOtpDeliveryController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const orderId = req.params.orderId;
        const { otp } = req.body;
        const result = await orderService.verifyDropOtpDelivery(orderId, deliveryPartnerId, otp);
        return sendResponse(res, 200, 'OTP verified', {
            order: toDeliveryTripDto(result.order),
        });
    } catch (err) {
        next(err);
    }
}

export async function completeDeliveryController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const orderId = req.params.orderId;
        const order = await orderService.completeDelivery(orderId, deliveryPartnerId, req.body || {});
        return sendResponse(res, 200, 'Delivery completed', {
            order: toDeliveryTripDto(order),
        });
    } catch (err) {
        next(err);
    }
}

export async function updateOrderStatusDeliveryController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const orderId = req.params.orderId;
        const dto = validateOrderStatusDto(req.body);
        const order = await orderService.updateOrderStatusDelivery(orderId, deliveryPartnerId, dto.orderStatus);
        return sendResponse(res, 200, 'Order status updated', {
            order: toOrderMutationAck(order),
        });
    } catch (err) {
        next(err);
    }
}

export async function getCurrentTripDeliveryController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const order = await orderService.getCurrentTripDelivery(deliveryPartnerId);
        return sendResponse(res, 200, 'Current trip retrieved', {
            activeOrder: order ? toDeliveryTripDto(order) : null,
        });
    } catch (err) {
        next(err);
    }
}

export async function createCollectQrController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const orderId = req.params.orderId;
        const customerInfo = req.body || {};
        const result = await orderService.createCollectQr(orderId, deliveryPartnerId, customerInfo);
        return sendResponse(res, 200, 'QR created', result);
    } catch (err) {
        next(err);
    }
}

export async function getOrderByIdDeliveryController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const orderId = req.params.orderId;
        const order = await orderService.getOrderById(orderId, { deliveryPartnerId });
        return sendResponse(res, 200, 'Order retrieved', {
            order: toDeliveryTripDto(order),
        });
    } catch (err) {
        next(err);
    }
}

export async function getPaymentStatusController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const orderId = req.params.orderId;
        const result = await orderService.getPaymentStatus(orderId, deliveryPartnerId);
        return sendResponse(res, 200, 'Payment status retrieved', result);
    } catch (err) {
        next(err);
    }
}

export async function listOrdersAdminController(req, res, next) {
    try {
        const result = await orderService.listOrdersAdmin(req.query);
        return sendResponse(res, 200, 'Orders retrieved', mapListResult(result, 'ADMIN'));
    } catch (err) {
        next(err);
    }
}

export async function getOrderByIdAdminController(req, res, next) {
    try {
        const orderId = req.params.orderId;
        const order = await orderService.getOrderById(orderId, { admin: true });
        return sendResponse(res, 200, 'Order retrieved', {
            order: toOrderDetailDto(order, { role: 'ADMIN' }),
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Admin Accept/Reject order (acts on behalf of restaurant).
 * Used by Admin → Orders → Accept/Reject buttons.
 */
export async function updateOrderStatusAdminController(req, res, next) {
    try {
        const orderId = req.params.orderId;
        const dto = validateAdminOrderStatusDto(req.body);
        const adminId = req.user?.userId;

        const updated = await orderService.updateOrderStatusAdmin(
            orderId,
            adminId,
            dto.orderStatus,
            dto.reason || "",
        );
        return sendResponse(res, 200, 'Order status updated', {
            order: toOrderMutationAck(updated),
        });
    } catch (err) {
        next(err);
    }
}

export async function assignDeliveryPartnerController(req, res, next) {
    try {
        const adminId = req.user?.userId;
        const orderId = req.params.orderId;
        const dto = validateAssignDeliveryDto(req.body);
        const order = await orderService.assignDeliveryPartnerAdmin(orderId, dto.deliveryPartnerId, adminId);
        return sendResponse(res, 200, 'Delivery partner assigned', {
            order: toOrderMutationAck(order),
        });
    } catch (err) {
        next(err);
    }
}

export async function deleteOrderAdminController(req, res, next) {
    try {
        const adminId = req.user?.userId;
        const orderId = req.params.orderId;
        const result = await orderService.deleteOrderAdmin(orderId, adminId);
        return sendResponse(res, 200, 'Order deleted successfully', result);
    } catch (err) {
        next(err);
    }
}

export async function resendDeliveryNotificationRestaurantController(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        const orderId = req.params.orderId;
        const result = await orderService.resendDeliveryNotificationRestaurant(orderId, restaurantId);
        return sendResponse(res, 200, 'Notification resent successfully', result);
    } catch (err) {
        next(err);
    }
}
