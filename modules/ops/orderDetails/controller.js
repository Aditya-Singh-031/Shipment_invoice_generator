'use strict';

const orderDetailService = require('./service');
const { createOrderDetailSchema, updateOrderDetailSchema } = require('./validation');
const { sendSuccess, sendError } = require('../utils/response');

const getByOrderId = async (req, res) => {
    const detail = await orderDetailService.getByOrderId(req.params.orderId);
    if (!detail) return sendError(res, 'Order details not found', 404);
    return sendSuccess(res, { orderDetail: detail });
};

const getById = async (req, res) => {
    const detail = await orderDetailService.getById(req.params.id);
    if (!detail) return sendError(res, 'Order details not found', 404);
    return sendSuccess(res, { orderDetail: detail });
};

const update = async (req, res) => {
    const { error, value } = updateOrderDetailSchema.validate(req.body, { abortEarly: false });
    if (error) return sendError(res, error.details.map(d => d.message).join(', '), 400);

    const detail = await orderDetailService.updateOrderDetail(req.params.id, value);
    if (!detail) return sendError(res, 'Order details not found', 404);
    return sendSuccess(res, { orderDetail: detail });
};

const remove = async (req, res) => {
    const detail = await orderDetailService.deleteOrderDetail(req.params.id);
    if (!detail) return sendError(res, 'Order details not found', 404);
    return sendSuccess(res, { message: 'Order details deleted successfully' });
};

module.exports = { getByOrderId, getById, update, remove };
