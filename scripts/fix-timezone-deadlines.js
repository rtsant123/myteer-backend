const mongoose = require('mongoose');
const Round = require('../models/Round');
const House = require('../models/House');
require('dotenv').config();

// Convert IST time to UTC (correct conversion)
function istToUtc(dateStr, timeStr) {
  const [istHour, istMin] = timeStr.split(':').map(Number);
  const date = new Date(dateStr);

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  // Convert IST (UTC+5:30) to UTC
  // IST time - 5:30 = UTC time
  const totalIstMinutes = istHour * 60 + istMin;
  const totalUtcMinutes = totalIstMinutes - (5 * 60 + 30);

  const utcHour = Math.floor(totalUtcMinutes / 60);
  const utcMin = totalUtcMinutes % 60;

  return new Date(Date.UTC(year, month, day, utcHour, utcMin, 0, 0));
}

async function fixTimezones() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all non-finished rounds (pending, live)
    const rounds = await Round.find({
      status: { $in: ['pending', 'live'] }
    }).populate('house');

    console.log(`📊 Found ${rounds.length} active rounds to fix`);

    let fixedCount = 0;

    for (const round of rounds) {
      if (!round.house || !round.deadlineTime) {
        console.log(`⚠️  Skipping round ${round._id} - missing house or deadlineTime`);
        continue;
      }

      // Recalculate deadline using IST conversion
      const oldDeadline = round.deadline;
      const newDeadline = istToUtc(round.date, round.deadlineTime);

      console.log(`\n🔄 Fixing Round ${round._id}:`);
      console.log(`   House: ${round.house.name}`);
      console.log(`   Date: ${round.date.toISOString().split('T')[0]}`);
      console.log(`   Time: ${round.deadlineTime} IST`);
      console.log(`   OLD deadline (Bangkok logic): ${oldDeadline.toISOString()}`);
      console.log(`   NEW deadline (IST logic): ${newDeadline.toISOString()}`);

      // Update the round
      round.deadline = newDeadline;
      await round.save();

      fixedCount++;
      console.log(`   ✅ Fixed!`);
    }

    console.log(`\n✅ Migration complete! Fixed ${fixedCount} rounds`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixTimezones();
