'use strict';

const buyerService = require('./service');
const { createBuyerSchema, updateBuyerSchema } = require('./validation');
const { sendSuccess, sendError } = require('../utils/response');

const create = async (req, res) => {
    const { error, value } = createBuyerSchema.validate(req.body, { abortEarly: false });
    if (error) return sendError(res, error.details.map(d => d.message).join(', '), 400);

    const buyer = await buyerService.createBuyer(value);
    return sendSuccess(res, { buyer }, 201);
};

const getById = async (req, res) => {
    const buyer = await buyerService.getBuyerById(req.params.id);
    if (!buyer) return sendError(res, 'Buyer not found', 404);
    return sendSuccess(res, { buyer });
};

const list = async (req, res) => {
    const { page, limit, search } = req.query;
    const result = await buyerService.listBuyers({ page, limit, search });
    return sendSuccess(res, result);
};

const update = async (req, res) => {
    const { error, value } = updateBuyerSchema.validate(req.body, { abortEarly: false });
    if (error) return sendError(res, error.details.map(d => d.message).join(', '), 400);

    const buyer = await buyerService.updateBuyer(req.params.id, value);
    if (!buyer) return sendError(res, 'Buyer not found', 404);
    return sendSuccess(res, { buyer });
};

const remove = async (req, res) => {
    const buyer = await buyerService.deleteBuyer(req.params.id);
    if (!buyer) return sendError(res, 'Buyer not found', 404);
    return sendSuccess(res, { message: 'Buyer deleted successfully' });
};

module.exports = { create, getById, list, update, remove };
