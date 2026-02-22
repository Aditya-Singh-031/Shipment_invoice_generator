'use strict';

const OpsOrderDetail = require('./model');

/**
 * Create an order detail document.
 * @param {Object} data
 * @param {import('mongoose').ClientSession} [session]
 */
const createOrderDetail = async (data, session) => {
    const opts = session ? { session } : {};
    const [detail] = await OpsOrderDetail.create([data], opts);
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
 * @param {import('mongoose').ClientSession} [session]
 */
const updateOrderDetail = async (id, data, session) => {
    const opts = { new: true, runValidators: true };
    if (session) opts.session = session;

    const detail = await OpsOrderDetail.findOneAndUpdate(
        { _id: id, is_deleted: false },
        { $set: data },
        opts
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
