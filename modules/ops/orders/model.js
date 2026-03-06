'use strict';

const mongoose = require('mongoose');
const opsDb = require('../utils/opsDb');
const Schema = mongoose.Schema;

const ORDER_STATUSES = [
    'INQUIRY',
    'CONFIRMED',
    'PENDING',
    'PO_RELEASED',
    'RECEIVED',
    'PACKED',
    'COMPLETE',
    'CANCELLED'
];

const OpsOrderSchema = new Schema({
    buyer_id: { type: Schema.Types.ObjectId, ref: 'OpsBuyer', required: true, index: true },
    consignee_id: { type: Schema.Types.ObjectId, ref: 'OpsBuyer' },
    order_number: { type: String, unique: true, index: true },
    order_date: { type: Date, default: Date.now },
    currency: { type: String, enum: ['INR', 'USD', 'EUR', 'GBP'], default: 'INR' },
    status: { type: String, enum: ORDER_STATUSES, default: 'INQUIRY' },
    order_details_id: { type: Schema.Types.ObjectId, ref: 'OpsOrderDetail' },

    // --- Proforma Invoice fields ---
    pi_number: { type: String, trim: true, sparse: true, index: true },
    pi_date: { type: Date },
    payment_terms: { type: String, trim: true },
    delivery_terms: { type: String, enum: ['FOB', 'EXW', 'CFR', 'CIF', ''], default: '' },
    bank_account_key: { type: String, enum: ['HDFC', 'SBERBANK', ''], default: '' },
    bank_account_info: {
        bank_name: { type: String, trim: true },
        account_name: { type: String, trim: true },
        account_number: { type: String, trim: true },
        ifsc_code: { type: String, trim: true },
        swift_code: { type: String, trim: true }
    },

    subtotal: { type: Number, default: 0 },
    grand_total: { type: Number, default: 0 },

    is_deleted: { type: Boolean, default: false },

    last_updated_by: {
        id: String,
        name: String
    }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

OpsOrderSchema.statics.ORDER_STATUSES = ORDER_STATUSES;

module.exports = opsDb.model('OpsOrder', OpsOrderSchema, 'orders');
