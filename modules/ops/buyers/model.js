'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OpsBuyerSchema = new Schema({
    cust_name: { type: String, required: true, trim: true },
    cust_id: { type: String, unique: true, trim: true, index: true },

    address: {
        address_lines: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        country: { type: String, trim: true },
        pincode: { type: String, trim: true }
    },

    contact: {
        name: { type: String, trim: true },
        email: { type: String, trim: true },
        phone: { type: String, trim: true }
    },

    payment_terms: { type: String, trim: true },
    currency: { type: String, enum: ['INR', 'USD', 'EUR', 'GBP'], default: 'INR' },

    is_deleted: { type: Boolean, default: false },

    last_updated_by: {
        id: String,
        name: String
    }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('OpsBuyer', OpsBuyerSchema, 'ops_buyers');
