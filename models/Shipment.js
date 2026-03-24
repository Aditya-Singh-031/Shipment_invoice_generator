const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ShipmentSchema = new Schema({
  // --- Parties ---
  buyer_id: { type: Schema.Types.ObjectId, ref: 'Buyer' },
  consignee_id: { type: Schema.Types.ObjectId, ref: 'Buyer' },
  
  // CHA is just a string now, not a reference
  cha_details: { type: String }, 
  
  // --- Logistics & Header Info ---
  invoice_number: { type: String, required: true, unique: true },
  invoice_date: { type: Date, default: Date.now },
  replacement_to: { type: String, default: '' },
  dispatch_location: { type: String },
  pre_carriage: { type: String, default: 'Road Transport' },
  receipt_place: { type: String, default: 'Nhava Sheva Mumbai' },
  loading_port: { type: String, default: 'Nhava Sheva' },
  discharge_port: { type: String },
  delivery_terms: { type: String, enum: ['FOB', 'EXW', 'CFR', 'CIF'], default: 'FOB' },
  payment_terms: { type: String },
  
  // --- Weights & Packages ---
  package_count: { type: Number, default: 0 },
  net_weight_kg: { type: mongoose.Types.Decimal128, default: 0.0 },
  gross_weight_kg: { type: mongoose.Types.Decimal128, default: 0.0 },
  
  // --- Financials ---
  currency: { type: String, enum: ['USD', 'INR'], default: 'USD' },
  exchange_rate: { type: mongoose.Types.Decimal128, default: 1.0 }, 
  
  freight_cost: { type: mongoose.Types.Decimal128, default: 0.0 },
  insurance_cost: { type: mongoose.Types.Decimal128, default: 0.0 },
  fob_value: { type: mongoose.Types.Decimal128, default: 0.0 },
  
  is_freight_in_split: { type: Boolean, default: false },
  
  status: { type: String, enum: ['Draft', 'In Transit', 'Completed'], default: 'Draft' },
  
  last_updated_by: {
    id: String,
    name: String
  }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Shipment', ShipmentSchema);