const cron = require('node-cron');
const Round = require('../models/Round');
const House = require('../models/House');

// Helper to parse time string (HH:MM) and combine with date
// Convert Bangkok time (UTC+7) to UTC for absolute time
function combineDateAndTime(dateStr, timeStr) {
  const [bangkokHour, bangkokMin] = timeStr.split(':').map(Number);
  const date = new Date(dateStr);

  // Get UTC date components (date-only strings are parsed as UTC midnight)
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  // Convert Bangkok time (UTC+7) to UTC
  // If admin sets 15:30 Bangkok time, we need to store 08:30 UTC
  const utcHour = bangkokHour - 7; // Bangkok is UTC+7

  // Create UTC date (handle hour overflow/underflow with Date constructor)
  const deadline = new Date(Date.UTC(year, month, day, utcHour, bangkokMin, 0, 0));

  return deadline;
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

    console.log(`📊 Found ${rounds.length} rounds to check`);

    let updatedCount = 0;

    for (const round of rounds) {
      try {
        let updated = false;
        const houseName = round.house ? round.house.name : `House ID: ${round.house}`;

        const deadlinePassed = now >= round.deadline;

        console.log(`🔍 Checking round ${round._id} for ${houseName}:`, {
          frStatus: round.frStatus,
          srStatus: round.srStatus,
          forecastStatus: round.forecastStatus,
          deadline: round.deadline,
          now: now,
          deadlinePassed: deadlinePassed
        });

        // FR STATUS TRANSITIONS
        // FR: pending → live (when deadline passes)
        if (round.frStatus === 'pending' && deadlinePassed) {
          round.frStatus = 'live';
          updated = true;
          console.log(`✅ FR game for ${houseName} is now LIVE (waiting for FR result)`);
        }

        // SR STATUS TRANSITIONS (SEQUENTIAL - only after FR is finished)
        // SR: pending → live (when deadline passes AND FR is finished)
        if (round.srStatus === 'pending' && deadlinePassed) {
          round.srStatus = 'live';
          updated = true;
          console.log(`✅ SR game for ${houseName} is now LIVE (waiting for SR result)`);
        }

        // FORECAST STATUS TRANSITIONS
        // Forecast: pending → live (when deadline passes)
        if (round.forecastStatus === 'pending' && deadlinePassed) {
          round.forecastStatus = 'live';
          updated = true;
          console.log(`✅ FORECAST game for ${houseName} is now LIVE`);
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
          updatedCount++;
          console.log(`💾 Saved updates for round ${round._id}`);
        }
      } catch (error) {
        console.error(`❌ Error updating round ${round._id}:`, error);
      }
    }

    console.log(`✅ Round status update complete - Updated ${updatedCount} rounds`);
  } catch (error) {
    console.error('❌ Error updating round statuses:', error);
  }
}

// Auto-create round for a specific house (called when results are updated)
async function autoCreateRoundForHouse(houseId) {
  try {
    const tomorrow = getTomorrowDate();

    // Get the house
    const house = await House.findById(houseId);
    if (!house) {
      console.log(`❌ House ${houseId} not found`);
      return;
    }

    // Check if house is active and has auto-create enabled
    if (!house.isActive || !house.autoCreateRounds) {
      console.log(`⏭️  Skipping ${house.name} - auto-create disabled or house inactive`);
      return;
    }

    // Find next operating day (starting from tomorrow)
    let nextOperatingDate = new Date(tomorrow);
    let nextDayOfWeek = nextOperatingDate.getDay();
    let daysChecked = 0;
    const maxDaysToCheck = 7; // Don't check more than a week

    while (daysChecked < maxDaysToCheck) {
      if (house.operatingDays && house.operatingDays.includes(nextDayOfWeek)) {
        // Found an operating day
        break;
      }
      // Move to next day
      nextOperatingDate.setDate(nextOperatingDate.getDate() + 1);
      nextDayOfWeek = nextOperatingDate.getDay();
      daysChecked++;
    }

    if (daysChecked >= maxDaysToCheck) {
      console.log(`⏭️  Skipping ${house.name} - no operating days found in next week`);
      return;
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Check if round already exists for this date
    const existingRound = await Round.findOne({
      house: house._id,
      date: {
        $gte: nextOperatingDate,
        $lt: new Date(nextOperatingDate.getTime() + 24 * 60 * 60 * 1000)
      }
    });

    if (existingRound) {
      console.log(`ℹ️  Round already exists for ${house.name} on ${nextOperatingDate.toDateString()}`);
      return;
    }

    // Create new round for next operating day
    const deadline = combineDateAndTime(nextOperatingDate, house.deadlineTime);

    const newRound = await Round.create({
      house: house._id,
      date: nextOperatingDate,
      deadline,
      deadlineTime: house.deadlineTime,
      status: 'pending',
      frStatus: 'pending',
      srStatus: 'pending', // Both FR and SR available for betting together
      forecastStatus: 'pending'
    });

    console.log(`✅ Auto-created round for ${house.name} on ${nextOperatingDate.toDateString()} (${dayNames[nextDayOfWeek]})`);
    console.log(`   Deadline: ${deadline.toLocaleString()}`);
  } catch (error) {
    console.error(`❌ Error auto-creating round for house ${houseId}:`, error);
  }
}

// Auto-create rounds for tomorrow (scheduled job)
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
        const deadline = combineDateAndTime(tomorrow, house.deadlineTime);

        const newRound = await Round.create({
          house: house._id,
          date: tomorrow,
          deadline,
          deadlineTime: house.deadlineTime,
          status: 'pending',
          frStatus: 'pending',
          srStatus: 'pending', // Both FR and SR available for betting together
          forecastStatus: 'pending'
        });

        console.log(`✅ Created new round for ${house.name} on ${tomorrow.toDateString()}`);
        console.log(`   Deadline: ${deadline.toLocaleString()}`);
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

  // DISABLED: Auto-create at midnight
  // Now rounds are auto-created ONLY when admin updates results (sequential trigger)
  // cron.schedule('30 18 * * *', autoCreateRounds, {
  //   timezone: 'UTC'
  // });
  console.log('ℹ️  Auto-create at midnight DISABLED - rounds created after result updates');

  // Run status updater once on startup
  setTimeout(() => {
    updateRoundStatuses();
  }, 3000);
}

module.exports = { initScheduler, updateRoundStatuses, autoCreateRounds, autoCreateRoundForHouse };
