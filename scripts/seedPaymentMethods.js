require('dotenv').config();
const mongoose = require('mongoose');
const PaymentMethod = require('../models/PaymentMethod');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/myteer';

const paymentMethods = [
  {
    name: 'PhonePe / Google Pay',
    type: 'UPI',
    details: {
      upiId: 'admin@paytm'
    },
    isActive: true
  },
  {
    name: 'QR Code Payment',
    type: 'QR',
    details: {
      qrCodeUrl: 'https://via.placeholder.com/300x300?text=QR+Code'
    },
    isActive: true
  },
  {
    name: 'Bank Transfer',
    type: 'BANK',
    details: {
      accountHolder: 'Teer Betting Admin',
      accountNumber: '1234567890',
      ifscCode: 'SBIN0001234',
      bankName: 'State Bank of India'
    },
    isActive: true
  }
];

async function seedPaymentMethods() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Connected');

    // Clear existing payment methods
    console.log('🗑️  Clearing existing payment methods...');
    await PaymentMethod.deleteMany({});

    // Insert new payment methods
    console.log('📝 Inserting payment methods...');
    const inserted = await PaymentMethod.insertMany(paymentMethods);

    console.log(`✅ Successfully seeded ${inserted.length} payment methods:`);
    inserted.forEach(pm => {
      console.log(`   - ${pm.name} (${pm.type}) - ID: ${pm._id}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding payment methods:', error);
    process.exit(1);
  }
}

seedPaymentMethods();
