const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// Script to create admin user
async function createAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Admin details
    const adminPhone = '919999999999';
    const adminPassword = 'admin123';
    const adminName = 'Admin User';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ phone: adminPhone });
    if (existingAdmin) {
      // Update to make admin
      existingAdmin.isAdmin = true;
      await existingAdmin.save();
      console.log('✅ Updated existing user to admin:', adminPhone);
    } else {
      // Create new admin user
      const admin = await User.create({
        phone: adminPhone,
        password: adminPassword,
        name: adminName,
        isAdmin: true,
        balance: 10000 // Give admin some balance for testing
      });
      console.log('✅ Created new admin user:', adminPhone);
      console.log('📱 Phone:', adminPhone);
      console.log('🔑 Password:', adminPassword);
    }

    console.log('\n🎉 Admin user is ready!');
    console.log('Login with:');
    console.log('  Phone: 9999999999 (or 919999999999)');
    console.log('  Password: admin123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createAdmin();
