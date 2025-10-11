const cron = require('node-cron');
const House = require('../models/House');
const Round = require('../models/Round');

/**
 * Auto Round Creation Scheduler
 * Creates tomorrow's rounds automatically at midnight
 * based on today's round timings
 */

// Run every day at midnight (00:00)
const scheduleAutoRoundCreation = () => {
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('🔄 Starting auto-round creation for tomorrow...');
      await createTomorrowsRounds();
      console.log('✅ Auto-round creation completed successfully');
    } catch (error) {
      console.error('❌ Auto-round creation failed:', error);
    }
  });

  console.log('⏰ Auto-round creation scheduler initialized (runs daily at midnight)');
};

// Create tomorrow's rounds based on today's rounds
const createTomorrowsRounds = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  console.log(`📅 Creating rounds for: ${tomorrow.toDateString()}`);

  // Get all active houses
  const houses = await House.find({ isActive: true });
  console.log(`🏠 Found ${houses.length} active houses`);

  for (const house of houses) {
    try {
      // Check if tomorrow's round already exists
      const existingRound = await Round.findOne({
        house: house._id,
        date: tomorrow
      });

      if (existingRound) {
        console.log(`⏭️  Round already exists for ${house.name} on ${tomorrow.toDateString()}`);
        continue;
      }

      // Find today's round for this house
      const todayRound = await Round.findOne({
        house: house._id,
        date: today
      }).sort({ createdAt: -1 }); // Get most recent

      if (!todayRound) {
        console.log(`⚠️  No template round found for ${house.name}, skipping...`);
        continue;
      }

      // Extract time patterns from today's round
      const frOpenHour = todayRound.frOpenTime.getHours();
      const frOpenMinute = todayRound.frOpenTime.getMinutes();
      const frCloseHour = todayRound.frCloseTime.getHours();
      const frCloseMinute = todayRound.frCloseTime.getMinutes();
      const srOpenHour = todayRound.srOpenTime.getHours();
      const srOpenMinute = todayRound.srOpenTime.getMinutes();
      const srCloseHour = todayRound.srCloseTime.getHours();
      const srCloseMinute = todayRound.srCloseTime.getMinutes();

      // Create tomorrow's times with same hours/minutes
      const tomorrowFROpen = new Date(tomorrow);
      tomorrowFROpen.setHours(frOpenHour, frOpenMinute, 0, 0);

      const tomorrowFRClose = new Date(tomorrow);
      tomorrowFRClose.setHours(frCloseHour, frCloseMinute, 0, 0);

      const tomorrowSROpen = new Date(tomorrow);
      tomorrowSROpen.setHours(srOpenHour, srOpenMinute, 0, 0);

      const tomorrowSRClose = new Date(tomorrow);
      tomorrowSRClose.setHours(srCloseHour, srCloseMinute, 0, 0);

      // Create tomorrow's round
      const newRound = await Round.create({
        house: house._id,
        date: tomorrow,
        frOpenTime: tomorrowFROpen,
        frCloseTime: tomorrowFRClose,
        srOpenTime: tomorrowSROpen,
        srCloseTime: tomorrowSRClose,
        status: 'open'
      });

      console.log(`✅ Created round for ${house.name}`);
      console.log(`   FR: ${formatTime(tomorrowFROpen)} - ${formatTime(tomorrowFRClose)}`);
      console.log(`   SR: ${formatTime(tomorrowSROpen)} - ${formatTime(tomorrowSRClose)}`);
    } catch (error) {
      console.error(`❌ Failed to create round for ${house.name}:`, error);
    }
  }
};

// Manual trigger (for testing or manual execution)
const manuallyCreateTomorrowsRounds = async () => {
  console.log('🔧 Manually triggering round creation...');
  await createTomorrowsRounds();
};

// Helper to format time
const formatTime = (date) => {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

module.exports = {
  scheduleAutoRoundCreation,
  manuallyCreateTomorrowsRounds,
  createTomorrowsRounds
};
