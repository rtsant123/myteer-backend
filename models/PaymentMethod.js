const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['UPI', 'BANK', 'QR'],
    required: true
  },
  details: {
    upiId: String,
    accountNumber: String,
    ifscCode: String,
    bankName: String,
    accountHolder: String,
    qrCodeUrl: String
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('PaymentMethod', paymentMethodSchema);
