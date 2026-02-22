'use strict';

const Joi = require('joi');

const addressSchema = Joi.object({
    address_lines: Joi.string().allow('', null),
    city: Joi.string().allow('', null),
    state: Joi.string().allow('', null),
    country: Joi.string().required().trim(),
    pincode: Joi.string().allow('', null)
});

const contactSchema = Joi.object({
    name: Joi.string().allow('', null),
    email: Joi.string().email().allow('', null),
    phone: Joi.string().allow('', null)
});

const createBuyerSchema = Joi.object({
    cust_name: Joi.string().required().trim(),
    cust_id: Joi.string().required().trim(),
    address: addressSchema.required(),
    contact: contactSchema,
    payment_terms: Joi.string().allow('', null),
    currency: Joi.string().valid('INR', 'USD', 'EUR', 'GBP')
});

const updateBuyerSchema = Joi.object({
    cust_name: Joi.string().trim(),
    cust_id: Joi.string().trim(),
    address: addressSchema,
    contact: contactSchema,
    payment_terms: Joi.string().allow('', null),
    currency: Joi.string().valid('INR', 'USD', 'EUR', 'GBP')
}).min(1);

module.exports = { createBuyerSchema, updateBuyerSchema };
