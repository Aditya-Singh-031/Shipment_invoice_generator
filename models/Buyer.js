const mongoose = require('mongoose');

const BuyerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  gst_number: { type: String, trim: true }, // Kept optional, let me know if this needs to be required too
  address: { type: String, trim: true },
  
  // Role removed as requested.
  
  pan_no: { type: String, trim: true }, // Now Required
  iec_code: { type: String,  trim: true }, // Now Required
  
  last_updated_by: {
    id: String,
    name: String
  }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Buyer', BuyerSchema);