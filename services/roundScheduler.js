const cron = require('node-cron');
const Round = require('../models/Round');
const House = require('../models/House');

// Helper to parse time string (HH:MM) and combine with date
function combineDateAndTime(dateStr, timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date(dateStr);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

// Helper to get tomorrow's date
function getTomorrowDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

// Update round statuses based on current time
async function updateRoundStatuses() {
  try {
    const now = new Date();
    console.log(`🔄 [${now.toISOString()}] Checking round statuses...`);

    // Find pending rounds that should be live
    const pendingRounds = await Round.find({
      status: 'pending',
      frDeadline: { $lte: now }
    }).populate('house');

    for (const round of pendingRounds) {
      round.status = 'live';
      await round.save();
      console.log(`✅ Round ${round._id} for ${round.house.name} is now LIVE`);
    }

    // Find live rounds where FR deadline passed
    const liveRounds = await Round.find({
      status: 'live',
      frDeadline: { $lte: now }
    }).populate('house');

    for (const round of liveRounds) {
      if (now >= round.srDeadline) {
        round.status = 'sr_closed';
      } else {
        round.status = 'fr_closed';
      }
      await round.save();
      console.log(`✅ Round ${round._id} for ${round.house.name} status: ${round.status}`);
    }

    // Find fr_closed rounds where SR deadline passed
    const frClosedRounds = await Round.find({
      status: 'fr_closed',
      srDeadline: { $lte: now }
    }).populate('house');

    for (const round of frClosedRounds) {
      round.status = 'sr_closed';
      await round.save();
      console.log(`✅ Round ${round._id} for ${round.house.name} - SR now closed`);
    }

    console.log(`✅ Round status update complete`);
  } catch (error) {
    console.error('❌ Error updating round statuses:', error);
  }
}

// Auto-create rounds for tomorrow
async function autoCreateRounds() {
  try {
    const tomorrow = getTomorrowDate();
    console.log(`🔄 Checking for missing rounds for ${tomorrow.toDateString()}...`);

    // Get all active houses with auto-create enabled
    const houses = await House.find({
      isActive: true,
      autoCreateRounds: true
    });

    for (const house of houses) {
      // Check if round already exists for tomorrow
      const existingRound = await Round.findOne({
        house: house._id,
        date: {
          $gte: tomorrow,
          $lt: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)
        }
      });

      if (!existingRound) {
        // Create new round for tomorrow
        const frDeadline = combineDateAndTime(tomorrow, house.frDeadlineTime);
        const srDeadline = combineDateAndTime(tomorrow, house.srDeadlineTime);

        const newRound = await Round.create({
          house: house._id,
          date: tomorrow,
          frDeadline,
          srDeadline,
          status: 'pending'
        });

        console.log(`✅ Created new round for ${house.name} on ${tomorrow.toDateString()}`);
        console.log(`   FR Deadline: ${frDeadline.toLocaleString()}`);
        console.log(`   SR Deadline: ${srDeadline.toLocaleString()}`);
      } else {
        console.log(`ℹ️  Round already exists for ${house.name} on ${tomorrow.toDateString()}`);
      }
    }

    console.log(`✅ Auto-create rounds complete`);
  } catch (error) {
    console.error('❌ Error auto-creating rounds:', error);
  }
}

// Initialize scheduler
function initScheduler() {
  console.log('🚀 Initializing Round Scheduler...');

  // Update round statuses every minute
  cron.schedule('* * * * *', updateRoundStatuses);
  console.log('✅ Status updater scheduled (every minute)');

  // Auto-create rounds at midnight IST (18:30 UTC)
  cron.schedule('30 18 * * *', autoCreateRounds, {
    timezone: 'UTC'
  });
  console.log('✅ Auto-create scheduler enabled (daily at midnight IST)');

  // Run once on startup
  setTimeout(() => {
    updateRoundStatuses();
    autoCreateRounds();
  }, 3000);
}

module.exports = { initScheduler, updateRoundStatuses, autoCreateRounds };
