'use strict';

const OpsOrderDetail = require('./model');

/**
 * Create an order detail document.
 * @param {Object} data
 */
const createOrderDetail = async (data) => {
    const detail = await OpsOrderDetail.create(data);
    return detail;
};

/**
 * Get order details by order_id (excludes soft-deleted).
 */
const getByOrderId = async (orderId) => {
    const detail = await OpsOrderDetail.findOne({ order_id: orderId, is_deleted: false })
        .populate('items.product_id')
        .lean();
    return detail;
};

/**
 * Get order detail by _id (excludes soft-deleted).
 */
const getById = async (id) => {
    const detail = await OpsOrderDetail.findOne({ _id: id, is_deleted: false })
        .populate('items.product_id')
        .lean();
    return detail;
};

/**
 * Update order detail items.
 * @param {string} id
 * @param {Object} data
 */
const updateOrderDetail = async (id, data) => {
    const detail = await OpsOrderDetail.findOneAndUpdate(
        { _id: id, is_deleted: false },
        { $set: data },
        { new: true, runValidators: true }
    ).lean();
    return detail;
};

/**
 * Soft-delete an order detail document.
 */
const deleteOrderDetail = async (id) => {
    const detail = await OpsOrderDetail.findOneAndUpdate(
        { _id: id, is_deleted: false },
        { $set: { is_deleted: true } },
        { new: true }
    ).lean();
    return detail;
};

module.exports = { createOrderDetail, getByOrderId, getById, updateOrderDetail, deleteOrderDetail };
