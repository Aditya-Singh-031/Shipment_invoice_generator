'use strict';

const Joi = require('joi');

const ORDER_STATUSES = [
    'INQUIRY', 'CONFIRMED', 'PENDING', 'PO_RELEASED',
    'RECEIVED', 'PACKED', 'COMPLETE', 'CANCELLED'
];

const orderItemInput = Joi.object({
    brand: Joi.string().required().trim(),
    part_number: Joi.string().required().trim(),
    quantity: Joi.number().required().min(1),
    rate: Joi.number().required().min(0),
    // Optional fields
    description: Joi.string().allow('', null),
    igst_rate: Joi.number().min(0).default(18),
    quantity_filled: Joi.number().min(0).default(0),
    quantity_pending: Joi.number().min(0),
    quantity_cancelled: Joi.number().min(0).default(0)
});

const createOrderSchema = Joi.object({
    buyer_id: Joi.string().required(),
    consignee_id: Joi.string().allow('', null),
    order_date: Joi.date().default(() => new Date()),
    currency: Joi.string().valid('INR', 'USD', 'EUR', 'GBP'),
    brands: Joi.array().items(Joi.string().trim()).default([]),
    status: Joi.string().valid(...ORDER_STATUSES),
    items: Joi.array().items(orderItemInput).min(1).required(),
    // PI fields
    pi_number: Joi.string().allow('', null).trim(),
    pi_date: Joi.date().allow(null),
    payment_terms: Joi.string().allow('', null),
    delivery_terms: Joi.string().valid('FOB', 'EXW', 'CFR', 'CIF', '').allow('', null),
    bank_account_key: Joi.string().valid('HDFC', 'SBERBANK', '').allow('', null)
});

const updateOrderSchema = Joi.object({
    buyer_id: Joi.string(),
    consignee_id: Joi.string().allow('', null),
    order_date: Joi.date(),
    currency: Joi.string().valid('INR', 'USD', 'EUR', 'GBP'),
    brands: Joi.array().items(Joi.string().trim()),
    status: Joi.string().valid(...ORDER_STATUSES),
    pi_number: Joi.string().allow('', null).trim(),
    pi_date: Joi.date().allow(null),
    payment_terms: Joi.string().allow('', null),
    delivery_terms: Joi.string().valid('FOB', 'EXW', 'CFR', 'CIF', '').allow('', null),
    bank_account_key: Joi.string().valid('HDFC', 'SBERBANK', '').allow('', null)
}).min(1);

const updateStatusSchema = Joi.object({
    status: Joi.string().valid(...ORDER_STATUSES).required()
});

module.exports = { createOrderSchema, updateOrderSchema, updateStatusSchema, ORDER_STATUSES };
