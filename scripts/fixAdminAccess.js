require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/myteer';

async function fixAdminAccess() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Connected');

    // Remove admin access from 8971128147
    const user1 = await User.findOne({ phone: { $in: ['8971128147', '918971128147'] } });
    if (user1) {
      user1.isAdmin = false;
      await user1.save();
      console.log(`✅ Removed admin access from ${user1.phone} (${user1.name || 'User'})`);
    } else {
      console.log('⚠️  User 8971128147 not found');
    }

    // Ensure 9999999999 is admin
    const admin = await User.findOne({ phone: { $in: ['9999999999', '919999999999'] } });
    if (admin) {
      admin.isAdmin = true;
      await admin.save();
      console.log(`✅ Confirmed admin access for ${admin.phone} (${admin.name || 'Admin'})`);
    } else {
      console.log('⚠️  Admin user 9999999999 not found');
    }

    // Show all users and their admin status
    console.log('\n📋 Current Users:');
    const allUsers = await User.find({}).select('phone name isAdmin balance');
    allUsers.forEach(user => {
      console.log(`   ${user.isAdmin ? '👑' : '👤'} ${user.phone} - ${user.name || 'N/A'} - Balance: ₹${user.balance} ${user.isAdmin ? '(ADMIN)' : '(User)'}`);
    });

    console.log('\n✅ Admin access fixed!');
    console.log('   👑 Admin: 9999999999');
    console.log('   👤 User:  8971128147');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing admin access:', error);
    process.exit(1);
  }
}

fixAdminAccess();
