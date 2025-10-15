const mongoose = require('mongoose');
const House = require('../models/House');
require('dotenv').config();

// Migration script to add operatingDays to existing houses
async function migrateHouseOperatingDays() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all houses
    const houses = await House.find({});
    console.log(`📊 Found ${houses.length} houses to migrate`);

    let updated = 0;

    for (const house of houses) {
      if (!house.operatingDays || house.operatingDays.length === 0) {
        house.operatingDays = [1, 2, 3, 4, 5, 6]; // Monday-Saturday (skip Sunday)
        await house.save();
        updated++;
        console.log(`✅ Updated house ${house.name} with operating days: Mon-Sat`);
      }
    }

    console.log(`\n✅ Migration complete! Updated ${updated} houses`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateHouseOperatingDays();
