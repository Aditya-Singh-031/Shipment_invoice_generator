'use strict';

const OpsBuyer = require('./model');

/**
 * Create a new buyer.
 */
const createBuyer = async (data) => {
    const buyer = await OpsBuyer.create(data);
    return buyer;
};

/**
 * Get a single buyer by _id (excludes soft-deleted).
 */
const getBuyerById = async (id) => {
    const buyer = await OpsBuyer.findOne({ _id: id, is_deleted: false }).lean();
    return buyer;
};

/**
 * List buyers with pagination (excludes soft-deleted).
 * @param {Object} options - { page, limit, search }
 */
const listBuyers = async ({ page = 1, limit = 20, search }) => {
    const query = { is_deleted: false };

    if (search) {
        const regex = new RegExp(search, 'i');
        query.$or = [
            { cust_name: regex },
            { cust_id: regex }
        ];
    }

    const skip = (page - 1) * limit;

    const [buyers, total] = await Promise.all([
        OpsBuyer.find(query).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
        OpsBuyer.countDocuments(query)
    ]);

    return {
        buyers,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / limit)
        }
    };
};

/**
 * Update a buyer by _id.
 */
const updateBuyer = async (id, data) => {
    const buyer = await OpsBuyer.findOneAndUpdate(
        { _id: id, is_deleted: false },
        { $set: data },
        { new: true, runValidators: true }
    ).lean();
    return buyer;
};

/**
 * Soft-delete a buyer by _id.
 */
const deleteBuyer = async (id) => {
    const buyer = await OpsBuyer.findOneAndUpdate(
        { _id: id, is_deleted: false },
        { $set: { is_deleted: true } },
        { new: true }
    ).lean();
    return buyer;
};

module.exports = { createBuyer, getBuyerById, listBuyers, updateBuyer, deleteBuyer };
