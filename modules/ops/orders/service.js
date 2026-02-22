'use strict';

const mongoose = require('mongoose');
const OpsOrder = require('./model');
const OpsOrderDetail = require('../orderDetails/model');
const OpsProduct = require('../products/model');
const generateOrderNumber = require('../utils/generateOrderNumber');
const { resolveBankAccount } = require('../utils/bankAccounts');

/**
 * Create an order with items without a mongoose transaction (standalone support).
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
            bank_account_info: data.bank_account_key ? resolveBankAccount(data.bank_account_key) : undefined,
            subtotal,
            tax_total: taxTotal,
            grand_total: grandTotal
        });

        // --- Create OrderDetails ---
        console.log('[createOrder] Creating OpsOrderDetail with', processedItems.length, 'items for order', order._id);
        const orderDetail = await OpsOrderDetail.create({
            order_id: order._id,
            items: processedItems
        });
        console.log('[createOrder] OpsOrderDetail created:', orderDetail._id, 'items saved:', orderDetail.items?.length);

        // --- Link order_details_id ---
        order.order_details_id = orderDetail._id;
        await order.save();
        console.log('[createOrder] Order linked. order_details_id =', order.order_details_id);

        // Sync to Product Master if confirmed on creation
        if (data.status === 'CONFIRMED') {
            try { await syncProductMaster(order._id); } catch (err) {
                console.error('[syncProductMaster] Error on create:', err.message);
            }
        }

        return { order: order.toObject(), orderDetail: orderDetail.toObject() };
    } catch (err) {
        console.error('[createOrder] ERROR:', err.message, err.stack);
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
    if (order) {
        console.log('[getOrderById]', id, '→ order_details_id:', order.order_details_id?._id || order.order_details_id, 'items:', order.order_details_id?.items?.length || 0);
    }
    return order;
};

/**
 * List orders with pagination and optional filters.
 */
const listOrders = async ({ page = 1, limit = 20, status, dateFrom, dateTo, buyer_id, search }) => {
    const query = { is_deleted: false };

    if (status) {
        const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
        query.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
    }
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
 * Update order fields and optionally its items.
 */
const updateOrder = async (id, data, items) => {
    // Resolve bank if key changed
    if (data.bank_account_key) {
        const bankInfo = resolveBankAccount(data.bank_account_key);
        if (bankInfo) data.bank_account_info = bankInfo;
    }

    // If items are provided, recalculate totals and update order detail
    if (items && items.length > 0) {
        let subtotal = 0;
        let taxTotal = 0;
        const processedItems = [];

        for (const item of items) {
            const quantity = Number(item.quantity) || 0;
            const rate = Number(item.rate) || 0;
            const igstRate = Number(item.igst_rate) || 0;
            const quantityFilled = Number(item.quantity_filled) || 0;
            const quantityCancelled = Number(item.quantity_cancelled) || 0;
            const quantityPending = item.quantity_pending != null
                ? Number(item.quantity_pending)
                : quantity - quantityFilled - quantityCancelled;

            const taxableValue = quantity * rate;
            const taxAmount = taxableValue * (igstRate / 100);

            subtotal += taxableValue;
            taxTotal += taxAmount;

            processedItems.push({
                brand: item.brand || '',
                part_number: item.part_number,
                description: item.description || '',
                quantity, quantity_filled: quantityFilled,
                quantity_pending: quantityPending,
                quantity_cancelled: quantityCancelled,
                rate, igst_rate: igstRate,
                taxable_value: taxableValue,
                tax_amount: taxAmount,
                total_amount: taxableValue + taxAmount
            });
        }

        data.subtotal = subtotal;
        data.tax_total = taxTotal;
        data.grand_total = subtotal + taxTotal;

        // Update the order detail document
        const existingOrder = await OpsOrder.findOne({ _id: id, is_deleted: false });
        if (existingOrder && existingOrder.order_details_id) {
            await OpsOrderDetail.findByIdAndUpdate(
                existingOrder.order_details_id,
                { $set: { items: processedItems } }
            );
        }
    }

    const order = await OpsOrder.findOneAndUpdate(
        { _id: id, is_deleted: false },
        { $set: data },
        { new: true, runValidators: true }
    )
        .populate('buyer_id')
        .populate('consignee_id')
        .populate('order_details_id')
        .lean();
    return order;
};

/**
 * Sync order line items to Product Master on confirm.
 * Upserts by part_number. Does NOT overwrite rate (PI rate ≠ PM rate).
 */
async function syncProductMaster(orderId) {
    const order = await OpsOrder.findById(orderId).populate('order_details_id');
    if (!order || !order.order_details_id) return;

    const items = order.order_details_id.items || [];
    for (const item of items) {
        if (!item.part_number) continue;
        await OpsProduct.findOneAndUpdate(
            { part_number: item.part_number },
            {
                $set: {
                    brand: item.brand || undefined,
                    description: item.description || undefined,
                    igst_rate: item.igst_rate ?? 18,
                },
                $setOnInsert: {
                    part_number: item.part_number,
                    rate: 0,       // PI rate ≠ PM rate — user sets this manually
                    hsn_code: '',
                }
            },
            { upsert: true, new: true }
        );
    }
    console.log('[syncProductMaster] Synced', items.length, 'items for order', orderId);
}

/**
 * Update order status.
 */
const updateStatus = async (id, status) => {
    const order = await OpsOrder.findOneAndUpdate(
        { _id: id, is_deleted: false },
        { $set: { status } },
        { new: true, runValidators: true }
    ).lean();

    // Sync to Product Master when confirmed
    if (order && status === 'CONFIRMED') {
        try { await syncProductMaster(id); } catch (err) {
            console.error('[syncProductMaster] Error:', err.message);
        }
    }

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
