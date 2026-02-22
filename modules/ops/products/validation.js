'use strict';

const Joi = require('joi');

const createProductSchema = Joi.object({
    part_number: Joi.string().required().trim(),
    brand: Joi.string().allow('', null).trim(),
    description: Joi.string().allow('', null).trim(),
    hsn_code: Joi.string().allow('', null).trim(),
    igst_rate: Joi.number().required().min(0),
    qty_per_pack: Joi.number().min(0).allow(null),
    net_weight: Joi.number().min(0).allow(null),
    gross_weight: Joi.number().min(0).allow(null),
    rate: Joi.number().required().min(0),
    mrp: Joi.number().min(0).allow(null),
    alternates: Joi.array().items(Joi.string().trim()).default([])
});

const updateProductSchema = Joi.object({
    part_number: Joi.string().trim(),
    brand: Joi.string().allow('', null).trim(),
    description: Joi.string().allow('', null).trim(),
    hsn_code: Joi.string().allow('', null).trim(),
    igst_rate: Joi.number().min(0),
    qty_per_pack: Joi.number().min(0).allow(null),
    net_weight: Joi.number().min(0).allow(null),
    gross_weight: Joi.number().min(0).allow(null),
    rate: Joi.number().min(0),
    mrp: Joi.number().min(0).allow(null),
    alternates: Joi.array().items(Joi.string().trim())
}).min(1);

module.exports = { createProductSchema, updateProductSchema };
