'use strict';

const mongoose = require('mongoose');
const opsDb = require('./opsDb');

/**
 * Auto-increment counter collection for generating sequential IDs.
 */
const CounterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 }
});

const Counter = opsDb.model('OpsCounter', CounterSchema, 'counters');

/**
 * Generates an order number in the format ORD-YYYY-XXXX.
 * Uses an atomic findOneAndUpdate to guarantee uniqueness under concurrency.
 *
 * @returns {Promise<string>} e.g. "ORD-2026-0001"
 */
const generateOrderNumber = async () => {
    const year = new Date().getFullYear();
    const counterId = `order_number_${year}`;

    const opts = { new: true, upsert: true };

    const counter = await Counter.findOneAndUpdate(
        { _id: counterId },
        { $inc: { seq: 1 } },
        opts
    );

    const padded = String(counter.seq).padStart(4, '0');
    return `ORD-${year}-${padded}`;
};

module.exports = generateOrderNumber;
