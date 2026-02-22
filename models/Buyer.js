const mongoose = require('mongoose');

const BuyerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  gst_number: { type: String, trim: true },
  address: { type: String, trim: true },
  pan_no: { type: String, trim: true },
  iec_code: { type: String, trim: true },

  // ── Ops extension fields (all optional, existing docs unaffected) ──
  cust_id: { type: String, trim: true, sparse: true, index: true },

  address_structured: {
    address_lines: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true }, // only country flag
    pincode: { type: String, trim: true }
  },

  contact: {
    name: { type: String, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true }
  },

  payment_terms: { type: String, trim: true },
  currency: { type: String, enum: ['INR', 'USD', 'EUR', 'GBP', ''], default: '' },

  last_updated_by: {
    id: String,
    name: String
  }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Buyer', BuyerSchema);