'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OrderItemSchema = new Schema({
    product_id: { type: Schema.Types.ObjectId, ref: 'OpsProduct' },
    brand: { type: String, trim: true },
    part_number: { type: String, trim: true },
    description: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    quantity_filled: { type: Number, default: 0, min: 0 },
    quantity_pending: { type: Number, default: 0, min: 0 },
    quantity_cancelled: { type: Number, default: 0, min: 0 },
    rate: { type: Number, required: true, min: 0 },
    igst_rate: { type: Number, required: true, min: 0 },
    taxable_value: { type: Number, default: 0 },
    tax_amount: { type: Number, default: 0 },
    total_amount: { type: Number, default: 0 }
}, { _id: true });

/**
 * Custom validator: quantity must equal the sum of filled + pending + cancelled.
 * Only enforced when all sub-quantities are explicitly provided.
 */
OrderItemSchema.pre('validate', function (next) {
    const sum = (this.quantity_filled || 0) + (this.quantity_pending || 0) + (this.quantity_cancelled || 0);
    if (sum > 0 && this.quantity !== sum) {
        return next(new Error(
            `Quantity mismatch for ${this.part_number}: quantity (${this.quantity}) must equal quantity_filled (${this.quantity_filled}) + quantity_pending (${this.quantity_pending}) + quantity_cancelled (${this.quantity_cancelled}) = ${sum}`
        ));
    }
    next();
});

const OpsOrderDetailSchema = new Schema({
    order_id: { type: Schema.Types.ObjectId, ref: 'OpsOrder', required: true, index: true },
    items: [OrderItemSchema],

    // --- Reference arrays ---
    po_ids: [{ type: String, trim: true }],
    supplier_invoice_ids: [{ type: String, trim: true }],
    packing_list_ids: [{ type: String, trim: true }],
    shipment_ids: [{ type: String, trim: true }],

    is_deleted: { type: Boolean, default: false },

    last_updated_by: {
        id: String,
        name: String
    }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('OpsOrderDetail', OpsOrderDetailSchema, 'ops_order_details');
