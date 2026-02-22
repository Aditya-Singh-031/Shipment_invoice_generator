'use strict';

const Joi = require('joi');

const orderItemSchema = Joi.object({
    product_id: Joi.string().allow('', null),
    part_number: Joi.string().required().trim(),
    description: Joi.string().allow('', null),
    quantity: Joi.number().required().min(0),
    quantity_filled: Joi.number().min(0).default(0),
    quantity_pending: Joi.number().min(0).default(0),
    quantity_cancelled: Joi.number().min(0).default(0),
    rate: Joi.number().min(0).allow(null),
    igst_rate: Joi.number().min(0).allow(null),
    taxable_value: Joi.number().min(0).allow(null),
    tax_amount: Joi.number().min(0).allow(null),
    total_amount: Joi.number().min(0).allow(null)
});

const createOrderDetailSchema = Joi.object({
    order_id: Joi.string().required(),
    items: Joi.array().items(orderItemSchema).min(1).required()
});

const updateOrderDetailSchema = Joi.object({
    items: Joi.array().items(orderItemSchema).min(1)
}).min(1);

module.exports = { orderItemSchema, createOrderDetailSchema, updateOrderDetailSchema };
