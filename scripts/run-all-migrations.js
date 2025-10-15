const mongoose = require('mongoose');
const House = require('../models/House');
const Round = require('../models/Round');
require('dotenv').config();

// Master migration script
async function runAllMigrations() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // ========== MIGRATION 1: House Operating Days ==========
    console.log('🔄 Migration 1: Adding operatingDays to houses...');
    const houses = await House.find({});
    console.log(`📊 Found ${houses.length} houses`);

    let housesUpdated = 0;
    for (const house of houses) {
      if (!house.operatingDays || house.operatingDays.length === 0) {
        house.operatingDays = [1, 2, 3, 4, 5, 6]; // Monday-Saturday
        await house.save();
        housesUpdated++;
        console.log(`   ✅ ${house.name} → Mon-Sat`);
      }
    }
    console.log(`✅ Migration 1 complete! Updated ${housesUpdated} houses\n`);

    // ========== MIGRATION 2: Round Statuses ==========
    console.log('🔄 Migration 2: Adding game mode statuses to rounds...');
    const rounds = await Round.find({});
    console.log(`📊 Found ${rounds.length} rounds`);

    let roundsUpdated = 0;
    const now = new Date();

    for (const round of rounds) {
      let needsUpdate = false;

      // Calculate frStatus if missing
      if (!round.frStatus) {
        if (round.frResult !== undefined && round.frResult !== null) {
          round.frStatus = 'finished';
        } else if (now >= round.frDeadline) {
          round.frStatus = 'live';
        } else {
          round.frStatus = 'pending';
        }
        needsUpdate = true;
      }

      // Calculate srStatus if missing
      if (!round.srStatus) {
        if (round.srResult !== undefined && round.srResult !== null) {
          round.srStatus = 'finished';
        } else if (now >= round.srDeadline) {
          round.srStatus = 'live';
        } else {
          round.srStatus = 'pending';
        }
        needsUpdate = true;
      }

      // Calculate forecastStatus if missing
      if (!round.forecastStatus) {
        if (round.frResult !== undefined && round.frResult !== null &&
            round.srResult !== undefined && round.srResult !== null) {
          round.forecastStatus = 'finished';
        } else if (now >= round.frDeadline) {
          round.forecastStatus = 'live';
        } else {
          round.forecastStatus = 'pending';
        }
        needsUpdate = true;
      }

      if (needsUpdate) {
        await round.save();
        roundsUpdated++;
        console.log(`   ✅ Round ${round._id}: FR=${round.frStatus}, SR=${round.srStatus}, FORECAST=${round.forecastStatus}`);
      }
    }
    console.log(`✅ Migration 2 complete! Updated ${roundsUpdated} rounds\n`);

    // ========== SUMMARY ==========
    console.log('========================================');
    console.log('✅ ALL MIGRATIONS COMPLETE!');
    console.log(`   Houses updated: ${housesUpdated}`);
    console.log(`   Rounds updated: ${roundsUpdated}`);
    console.log('========================================\n');

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run all migrations
runAllMigrations();
