require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/myteer';

async function addIndexes() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Connected\n');

    const db = mongoose.connection.db;

    console.log('📊 Adding database indexes for performance...\n');

    // =========================================================================
    // USER COLLECTION INDEXES
    // =========================================================================
    console.log('👤 Users Collection:');

    await db.collection('users').createIndex({ phone: 1 }, { unique: true });
    console.log('   ✅ Index on phone (unique)');

    await db.collection('users').createIndex({ isAdmin: 1 });
    console.log('   ✅ Index on isAdmin');

    await db.collection('users').createIndex({ createdAt: -1 });
    console.log('   ✅ Index on createdAt (descending)');

    await db.collection('users').createIndex({ balance: -1 });
    console.log('   ✅ Index on balance (descending)');

    await db.collection('users').createIndex({ 'referredBy': 1 });
    console.log('   ✅ Index on referredBy');

    // =========================================================================
    // BET COLLECTION INDEXES
    // =========================================================================
    console.log('\n🎲 Bets Collection:');

    await db.collection('bets').createIndex({ user: 1, createdAt: -1 });
    console.log('   ✅ Compound index on user + createdAt');

    await db.collection('bets').createIndex({ round: 1, house: 1 });
    console.log('   ✅ Compound index on round + house');

    await db.collection('bets').createIndex({ status: 1 });
    console.log('   ✅ Index on status');

    await db.collection('bets').createIndex({ createdAt: -1 });
    console.log('   ✅ Index on createdAt (descending)');

    await db.collection('bets').createIndex({ house: 1 });
    console.log('   ✅ Index on house');

    // =========================================================================
    // ROUND COLLECTION INDEXES
    // =========================================================================
    console.log('\n🔄 Rounds Collection:');

    await db.collection('rounds').createIndex({ house: 1, date: -1 });
    console.log('   ✅ Compound index on house + date');

    await db.collection('rounds').createIndex({ status: 1, frDeadline: 1 });
    console.log('   ✅ Compound index on status + frDeadline');

    await db.collection('rounds').createIndex({ status: 1, srDeadline: 1 });
    console.log('   ✅ Compound index on status + srDeadline');

    await db.collection('rounds').createIndex({ date: -1 });
    console.log('   ✅ Index on date (descending)');

    await db.collection('rounds').createIndex({ frStatus: 1 });
    console.log('   ✅ Index on frStatus');

    await db.collection('rounds').createIndex({ srStatus: 1 });
    console.log('   ✅ Index on srStatus');

    // =========================================================================
    // HOUSE COLLECTION INDEXES
    // =========================================================================
    console.log('\n🏠 Houses Collection:');

    await db.collection('houses').createIndex({ isActive: 1 });
    console.log('   ✅ Index on isActive');

    await db.collection('houses').createIndex({ name: 1 });
    console.log('   ✅ Index on name');

    // =========================================================================
    // TRANSACTION COLLECTION INDEXES
    // =========================================================================
    console.log('\n💰 Transactions Collection:');

    await db.collection('transactions').createIndex({ user: 1, createdAt: -1 });
    console.log('   ✅ Compound index on user + createdAt');

    await db.collection('transactions').createIndex({ type: 1 });
    console.log('   ✅ Index on type');

    await db.collection('transactions').createIndex({ status: 1 });
    console.log('   ✅ Index on status');

    // =========================================================================
    // DEPOSIT/WITHDRAWAL COLLECTION INDEXES
    // =========================================================================
    console.log('\n💸 Deposits Collection:');

    await db.collection('deposits').createIndex({ user: 1, createdAt: -1 });
    console.log('   ✅ Compound index on user + createdAt');

    await db.collection('deposits').createIndex({ status: 1 });
    console.log('   ✅ Index on status');

    console.log('\n💵 Withdrawals Collection:');

    await db.collection('withdrawals').createIndex({ user: 1, createdAt: -1 });
    console.log('   ✅ Compound index on user + createdAt');

    await db.collection('withdrawals').createIndex({ status: 1 });
    console.log('   ✅ Index on status');

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log('\n📊 INDEX SUMMARY:');
    console.log('='.repeat(60));

    const collections = ['users', 'bets', 'rounds', 'houses', 'transactions', 'deposits', 'withdrawals'];

    for (const collectionName of collections) {
      try {
        const indexes = await db.collection(collectionName).indexes();
        console.log(`\n${collectionName.toUpperCase()}:`);
        indexes.forEach(index => {
          const keys = Object.keys(index.key).map(k => `${k}: ${index.key[k]}`).join(', ');
          const unique = index.unique ? ' (UNIQUE)' : '';
          console.log(`   • ${keys}${unique}`);
        });
      } catch (err) {
        console.log(`   ⚠️  Collection not found (will be created on first use)`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ All indexes created successfully!');
    console.log('\n💡 BENEFITS:');
    console.log('   • Faster user lookups by phone');
    console.log('   • Faster bet queries by user/round/house');
    console.log('   • Faster round queries by date/status');
    console.log('   • Faster transaction history');
    console.log('   • Better performance as database grows');
    console.log('\n🚀 Database is now optimized for production!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding indexes:', error);
    process.exit(1);
  }
}

addIndexes();
