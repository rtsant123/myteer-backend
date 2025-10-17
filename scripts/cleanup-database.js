/**
 * Database Cleanup Script
 * Clears all rounds, houses, bets, transactions, deposits, and withdrawals
 * Keeps users and admin accounts intact
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Import models
const House = require('../models/House');
const Round = require('../models/Round');
const Bet = require('../models/Bet');
const Transaction = require('../models/Transaction');
const Deposit = require('../models/Deposit');
const Withdrawal = require('../models/Withdrawal');
const PaymentMethod = require('../models/PaymentMethod');

async function cleanupDatabase() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Count documents before cleanup
    console.log('📊 Current database state:');
    const beforeCounts = {
      houses: await House.countDocuments(),
      rounds: await Round.countDocuments(),
      bets: await Bet.countDocuments(),
      transactions: await Transaction.countDocuments(),
      deposits: await Deposit.countDocuments(),
      withdrawals: await Withdrawal.countDocuments(),
      paymentMethods: await PaymentMethod.countDocuments(),
    };
    console.table(beforeCounts);

    console.log('\n🗑️  Starting cleanup...\n');

    // Delete all rounds
    const roundsDeleted = await Round.deleteMany({});
    console.log(`✅ Deleted ${roundsDeleted.deletedCount} rounds`);

    // Delete all houses
    const housesDeleted = await House.deleteMany({});
    console.log(`✅ Deleted ${housesDeleted.deletedCount} houses`);

    // Delete all bets
    const betsDeleted = await Bet.deleteMany({});
    console.log(`✅ Deleted ${betsDeleted.deletedCount} bets`);

    // Delete all transactions
    const transactionsDeleted = await Transaction.deleteMany({});
    console.log(`✅ Deleted ${transactionsDeleted.deletedCount} transactions`);

    // Delete all deposits
    const depositsDeleted = await Deposit.deleteMany({});
    console.log(`✅ Deleted ${depositsDeleted.deletedCount} deposits`);

    // Delete all withdrawals
    const withdrawalsDeleted = await Withdrawal.deleteMany({});
    console.log(`✅ Deleted ${withdrawalsDeleted.deletedCount} withdrawals`);

    // Delete all payment methods
    const paymentMethodsDeleted = await PaymentMethod.deleteMany({});
    console.log(`✅ Deleted ${paymentMethodsDeleted.deletedCount} payment methods`);

    // Count documents after cleanup
    console.log('\n📊 Database state after cleanup:');
    const afterCounts = {
      houses: await House.countDocuments(),
      rounds: await Round.countDocuments(),
      bets: await Bet.countDocuments(),
      transactions: await Transaction.countDocuments(),
      deposits: await Deposit.countDocuments(),
      withdrawals: await Withdrawal.countDocuments(),
      paymentMethods: await PaymentMethod.countDocuments(),
    };
    console.table(afterCounts);

    console.log('\n✨ Database cleanup completed successfully!');
    console.log('👤 User accounts remain intact');

  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run cleanup
cleanupDatabase()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
