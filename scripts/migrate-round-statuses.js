const mongoose = require('mongoose');
const Round = require('../models/Round');
require('dotenv').config();

// Migration script to add status fields to existing rounds
async function migrateRoundStatuses() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all rounds
    const rounds = await Round.find({});
    console.log(`📊 Found ${rounds.length} rounds to migrate`);

    let updated = 0;
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
        updated++;
        console.log(`✅ Updated round ${round._id} for ${round.house}`);
        console.log(`   FR: ${round.frStatus}, SR: ${round.srStatus}, FORECAST: ${round.forecastStatus}`);
      }
    }

    console.log(`\n✅ Migration complete! Updated ${updated} rounds`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateRoundStatuses();
