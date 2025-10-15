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

    // Get all non-finished rounds
    const rounds = await Round.find({
      $or: [
        { frStatus: { $ne: 'finished' } },
        { srStatus: { $ne: 'finished' } },
        { forecastStatus: { $ne: 'finished' } }
      ]
    }).populate('house');

    for (const round of rounds) {
      let updated = false;

      // Update FR status: pending → live (when FR deadline passes)
      if (round.frStatus === 'pending' && now >= round.frDeadline) {
        round.frStatus = 'live';
        updated = true;
        console.log(`✅ FR game for ${round.house.name} is now LIVE`);
      }

      // Update SR status: pending → live (when SR deadline passes)
      if (round.srStatus === 'pending' && now >= round.srDeadline) {
        round.srStatus = 'live';
        updated = true;
        console.log(`✅ SR game for ${round.house.name} is now LIVE`);
      }

      // Update FORECAST status: pending → live (when FR deadline passes)
      if (round.forecastStatus === 'pending' && now >= round.frDeadline) {
        round.forecastStatus = 'live';
        updated = true;
        console.log(`✅ FORECAST game for ${round.house.name} is now LIVE`);
      }

      // Update overall status for compatibility
      if (round.frResult !== undefined && round.srResult !== undefined) {
        round.status = 'finished';
      } else if (round.frStatus === 'live' || round.srStatus === 'live' || round.forecastStatus === 'live') {
        round.status = 'live';
      } else {
        round.status = 'pending';
      }

      if (updated) {
        await round.save();
      }
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
    const tomorrowDayOfWeek = tomorrow.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    console.log(`🔄 Checking for missing rounds for ${tomorrow.toDateString()} (Day ${tomorrowDayOfWeek})...`);

    // Get all active houses with auto-create enabled
    const houses = await House.find({
      isActive: true,
      autoCreateRounds: true
    });

    for (const house of houses) {
      // Check if house operates on tomorrow's day
      if (!house.operatingDays || !house.operatingDays.includes(tomorrowDayOfWeek)) {
        console.log(`⏭️  Skipping ${house.name} - doesn't operate on ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][tomorrowDayOfWeek]}`);
        continue;
      }

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
          status: 'pending',
          frStatus: 'pending',
          srStatus: 'pending',
          forecastStatus: 'pending'
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
