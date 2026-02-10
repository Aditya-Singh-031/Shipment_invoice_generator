const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ShipmentDetailSchema = new Schema({
  shipment_id: { type: Schema.Types.ObjectId, ref: 'Shipment', required: true },
  
  item_id: { type: String }, 
  hsn_code: { type: String },
  part_number: { type: String },
  
  // This is the field for 'Order reference number' from Excel
  reference_number: { type: String }, 
  
  description: { type: String },
  quantity: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' },
  unit_price: { type: mongoose.Types.Decimal128, default: 0.0 },
  
  taxable_value: { type: mongoose.Types.Decimal128, default: 0.0 },
  igst_value: { type: mongoose.Types.Decimal128, default: 0.0 },
  
  last_updated_by: {
    id: String,
    name: String
  }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('ShipmentDetail', ShipmentDetailSchema, 'shipment_details');