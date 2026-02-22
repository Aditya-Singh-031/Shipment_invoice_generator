'use strict';

const OpsProduct = require('./model');

/**
 * Create a new product.
 */
const createProduct = async (data) => {
    const product = await OpsProduct.create(data);
    return product;
};

/**
 * Get a product by part_number (excludes soft-deleted).
 */
const getByPartNumber = async (partNumber) => {
    const product = await OpsProduct.findOne({ part_number: partNumber, is_deleted: false }).lean();
    return product;
};

/**
 * Get a product by _id (excludes soft-deleted).
 */
const getProductById = async (id) => {
    const product = await OpsProduct.findOne({ _id: id, is_deleted: false }).lean();
    return product;
};

/**
 * List products with pagination (excludes soft-deleted).
 * Supports filtering by brand and text search.
 */
const listProducts = async ({ page = 1, limit = 20, brand, search }) => {
    const query = { is_deleted: false };

    if (brand) {
        query.brand = new RegExp(brand, 'i');
    }

    if (search) {
        const regex = new RegExp(search, 'i');
        query.$or = [
            { part_number: regex },
            { description: regex },
            { brand: regex }
        ];
    }

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
        OpsProduct.find(query).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
        OpsProduct.countDocuments(query)
    ]);

    return {
        products,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / limit)
        }
    };
};

/**
 * Update a product by _id.
 */
const updateProduct = async (id, data) => {
    const product = await OpsProduct.findOneAndUpdate(
        { _id: id, is_deleted: false },
        { $set: data },
        { new: true, runValidators: true }
    ).lean();
    return product;
};

/**
 * Soft-delete a product by _id.
 */
const deleteProduct = async (id) => {
    const product = await OpsProduct.findOneAndUpdate(
        { _id: id, is_deleted: false },
        { $set: { is_deleted: true } },
        { new: true }
    ).lean();
    return product;
};

module.exports = { createProduct, getByPartNumber, getProductById, listProducts, updateProduct, deleteProduct };
