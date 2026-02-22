'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OpsProductSchema = new Schema({
    part_number: { type: String, required: true, unique: true, trim: true, index: true },
    brand: { type: String, trim: true, index: true },
    description: { type: String, trim: true },
    hsn_code: { type: String, trim: true },
    igst_rate: { type: Number, required: true },
    qty_per_pack: { type: Number },
    net_weight: { type: Number },
    gross_weight: { type: Number },
    rate: { type: Number, required: true },
    mrp: { type: Number },
    alternates: [{ type: String, trim: true }],

    is_deleted: { type: Boolean, default: false },

    last_updated_by: {
        id: String,
        name: String
    }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('OpsProduct', OpsProductSchema, 'ops_products');
