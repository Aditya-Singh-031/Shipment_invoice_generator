'use strict';

const mongoose = require('mongoose');
const OpsOrder = require('./model');
const OpsOrderDetail = require('../orderDetails/model');
const generateOrderNumber = require('../utils/generateOrderNumber');
const { resolveBankAccount } = require('../utils/bankAccounts');

/**
 * Create an order with items inside a mongoose transaction.
 *
 * No product-master lookup — uses the sell rate provided by the user.
 * Resolves bank_account_key to full bank details from hardcoded constants.
 */
const createOrder = async (data) => {
    try {
        const orderNumber = await generateOrderNumber();

        // --- Process items: use user-provided brand, rate, igst ---
        const processedItems = [];
        let subtotal = 0;
        let taxTotal = 0;

        for (const item of data.items) {
            const rate = Number(item.rate) || 0;
            const igstRate = Number(item.igst_rate) || 18;
            const quantity = Number(item.quantity);
            const quantityFilled = Number(item.quantity_filled) || 0;
            const quantityCancelled = Number(item.quantity_cancelled) || 0;
            const quantityPending = item.quantity_pending != null
                ? Number(item.quantity_pending)
                : quantity - quantityFilled - quantityCancelled;

            const taxableValue = quantity * rate;
            const taxAmount = taxableValue * (igstRate / 100);
            const totalAmount = taxableValue + taxAmount;

            subtotal += taxableValue;
            taxTotal += taxAmount;

            processedItems.push({
                brand: item.brand || '',
                part_number: item.part_number,
                description: item.description || '',
                quantity,
                quantity_filled: quantityFilled,
                quantity_pending: quantityPending,
                quantity_cancelled: quantityCancelled,
                rate,
                igst_rate: igstRate,
                taxable_value: taxableValue,
                tax_amount: taxAmount,
                total_amount: totalAmount
            });
        }

        const grandTotal = subtotal + taxTotal;

        // --- Create Order ---
        const order = await OpsOrder.create({
            buyer_id: data.buyer_id,
            consignee_id: data.consignee_id || undefined,
            order_number: orderNumber,
            order_date: data.order_date || new Date(),
            currency: data.currency,
            brands: data.brands || [],
            status: data.status || 'INQUIRY',
            pi_number: data.pi_number || undefined,
            pi_date: data.pi_date || undefined,
            payment_terms: data.payment_terms || undefined,
            delivery_terms: data.delivery_terms || undefined,
            bank_account_key: data.bank_account_key || '',
            bank_account_info: bankInfo || undefined,
            subtotal,
            tax_total: taxTotal,
            grand_total: grandTotal
        });

        // --- Create OrderDetails ---
        const orderDetail = await OpsOrderDetail.create({
            order_id: order._id,
            items: processedItems
        });

        // --- Link order_details_id ---
        order.order_details_id = orderDetail._id;
        await order.save();

        return { order: order.toObject(), orderDetail: orderDetail.toObject() };
    } catch (err) {
        throw err;
    }
};

/**
 * Get a single order by _id (excludes soft-deleted).
 */
const getOrderById = async (id) => {
    const order = await OpsOrder.findOne({ _id: id, is_deleted: false })
        .populate('buyer_id')
        .populate('consignee_id')
        .populate('order_details_id')
        .lean();
    return order;
};

/**
 * List orders with pagination and optional filters.
 */
const listOrders = async ({ page = 1, limit = 20, status, dateFrom, dateTo, buyer_id, search }) => {
    const query = { is_deleted: false };

    if (status) query.status = status;
    if (buyer_id) query.buyer_id = buyer_id;

    if (dateFrom || dateTo) {
        query.order_date = {};
        if (dateFrom) query.order_date.$gte = new Date(dateFrom);
        if (dateTo) {
            const to = new Date(dateTo);
            to.setHours(23, 59, 59, 999);
            query.order_date.$lte = to;
        }
    }

    if (search) {
        const regex = new RegExp(search, 'i');
        query.$or = [
            { order_number: regex },
            { pi_number: regex }
        ];
    }

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
        OpsOrder.find(query)
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit)
            .populate('buyer_id', 'cust_name cust_id')
            .lean(),
        OpsOrder.countDocuments(query)
    ]);

    return {
        orders,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / limit)
        }
    };
};

/**
 * Update order fields.
 */
const updateOrder = async (id, data) => {
    // Resolve bank if key changed
    if (data.bank_account_key) {
        const bankInfo = resolveBankAccount(data.bank_account_key);
        if (bankInfo) data.bank_account_info = bankInfo;
    }
    const order = await OpsOrder.findOneAndUpdate(
        { _id: id, is_deleted: false },
        { $set: data },
        { new: true, runValidators: true }
    ).lean();
    return order;
};

/**
 * Update order status.
 */
const updateStatus = async (id, status) => {
    const order = await OpsOrder.findOneAndUpdate(
        { _id: id, is_deleted: false },
        { $set: { status } },
        { new: true, runValidators: true }
    ).lean();
    return order;
};

/**
 * Soft-delete an order and its order details.
 */
const deleteOrder = async (id) => {
    try {
        const order = await OpsOrder.findOneAndUpdate(
            { _id: id, is_deleted: false },
            { $set: { is_deleted: true } },
            { new: true }
        ).lean();

        if (order.order_details_id) {
            await OpsOrderDetail.findOneAndUpdate(
                { _id: order.order_details_id },
                { $set: { is_deleted: true } }
            );
        }

        return order;
    } catch (err) {
        throw err;
    }
};

module.exports = { createOrder, getOrderById, listOrders, updateOrder, updateStatus, deleteOrder };
