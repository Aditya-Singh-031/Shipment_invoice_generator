'use strict';

const productService = require('./service');
const { createProductSchema, updateProductSchema } = require('./validation');
const { sendSuccess, sendError } = require('../utils/response');

const create = async (req, res) => {
    const { error, value } = createProductSchema.validate(req.body, { abortEarly: false });
    if (error) return sendError(res, error.details.map(d => d.message).join(', '), 400);

    const product = await productService.createProduct(value);
    return sendSuccess(res, { product }, 201);
};

const getByPartNumber = async (req, res) => {
    const product = await productService.getByPartNumber(req.params.partNumber);
    if (!product) return sendError(res, 'Product not found', 404);
    return sendSuccess(res, { product });
};

const getById = async (req, res) => {
    const product = await productService.getProductById(req.params.id);
    if (!product) return sendError(res, 'Product not found', 404);
    return sendSuccess(res, { product });
};

const list = async (req, res) => {
    const { page, limit, brand, search } = req.query;
    const result = await productService.listProducts({ page, limit, brand, search });
    return sendSuccess(res, result);
};

const update = async (req, res) => {
    const { error, value } = updateProductSchema.validate(req.body, { abortEarly: false });
    if (error) return sendError(res, error.details.map(d => d.message).join(', '), 400);

    const product = await productService.updateProduct(req.params.id, value);
    if (!product) return sendError(res, 'Product not found', 404);
    return sendSuccess(res, { product });
};

const remove = async (req, res) => {
    const product = await productService.deleteProduct(req.params.id);
    if (!product) return sendError(res, 'Product not found', 404);
    return sendSuccess(res, { message: 'Product deleted successfully' });
};

module.exports = { create, getByPartNumber, getById, list, update, remove };
