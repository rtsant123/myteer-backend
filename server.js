require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auto-update round statuses on every request (middleware)
let lastStatusUpdate = 0;
app.use(async (req, res, next) => {
  const now = Date.now();
  // Update statuses every 30 seconds max (to avoid too many updates)
  if (now - lastStatusUpdate > 30000) {
    lastStatusUpdate = now;
    const { updateRoundStatuses } = require('./services/roundScheduler');
    updateRoundStatuses().catch(err => console.error('Status update error:', err));
  }
  next();
});

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/myteer';
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB Connected');

  // Initialize round scheduler (auto-lifecycle + auto-creation)
  const { initScheduler } = require('./services/roundScheduler');
  initScheduler();
})
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/houses', require('./routes/houses'));
app.use('/api/rounds', require('./routes/rounds'));
app.use('/api/bets', require('./routes/bets'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/payment-methods', require('./routes/paymentMethods'));
app.use('/api/deposits', require('./routes/deposits'));
app.use('/api/withdrawals', require('./routes/withdrawals'));
app.use('/api/banners', require('./routes/banners'));
app.use('/api/otp', require('./routes/otp'));
app.use('/api/admin', require('./routes/admin'));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Myteer API is running' });
});

// Manual trigger for round status updates
app.post('/api/update-round-statuses', async (req, res) => {
  try {
    const { updateRoundStatuses } = require('./services/roundScheduler');
    await updateRoundStatuses();
    res.json({ success: true, message: 'Round statuses updated successfully' });
  } catch (error) {
    console.error('❌ Error updating round statuses:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Debug endpoint - show all rounds with their statuses
app.get('/api/debug/rounds', async (req, res) => {
  try {
    const Round = require('./models/Round');
    const rounds = await Round.find({}).populate('house').sort({ date: -1 }).limit(20);

    const now = new Date();
    const roundsData = rounds.map(round => ({
      id: round._id,
      houseName: round.house ? round.house.name : `House ID: ${round.house}`,
      date: round.date,
      frDeadline: round.frDeadline,
      srDeadline: round.srDeadline,
      frStatus: round.frStatus,
      srStatus: round.srStatus,
      forecastStatus: round.forecastStatus,
      status: round.status,
      frResult: round.frResult,
      srResult: round.srResult,
      currentTime: now,
      frDeadlinePassed: now >= round.frDeadline,
      srDeadlinePassed: now >= round.srDeadline
    }));

    res.json({
      success: true,
      currentTime: now,
      rounds: roundsData
    });
  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Verification Endpoint - Check migration status
app.get('/api/verify-migration', async (req, res) => {
  try {
    const House = require('./models/House');
    const Round = require('./models/Round');

    // Check houses
    const totalHouses = await House.countDocuments();
    const housesWithOperatingDays = await House.countDocuments({
      operatingDays: { $exists: true, $ne: [] }
    });
    const sampleHouse = await House.findOne().lean();

    // Check rounds
    const totalRounds = await Round.countDocuments();
    const roundsWithFrStatus = await Round.countDocuments({
      frStatus: { $exists: true }
    });
    const roundsWithSrStatus = await Round.countDocuments({
      srStatus: { $exists: true }
    });
    const roundsWithForecastStatus = await Round.countDocuments({
      forecastStatus: { $exists: true }
    });
    const sampleRound = await Round.findOne().lean();

    res.json({
      success: true,
      message: 'Migration verification complete',
      houses: {
        total: totalHouses,
        withOperatingDays: housesWithOperatingDays,
        migrationComplete: totalHouses === housesWithOperatingDays,
        sample: sampleHouse ? {
          name: sampleHouse.name,
          hasOperatingDays: !!sampleHouse.operatingDays,
          operatingDays: sampleHouse.operatingDays
        } : null
      },
      rounds: {
        total: totalRounds,
        withFrStatus: roundsWithFrStatus,
        withSrStatus: roundsWithSrStatus,
        withForecastStatus: roundsWithForecastStatus,
        migrationComplete: totalRounds === roundsWithFrStatus &&
                          totalRounds === roundsWithSrStatus &&
                          totalRounds === roundsWithForecastStatus,
        sample: sampleRound ? {
          id: sampleRound._id,
          date: sampleRound.date,
          frStatus: sampleRound.frStatus,
          srStatus: sampleRound.srStatus,
          forecastStatus: sampleRound.forecastStatus,
          frResult: sampleRound.frResult,
          srResult: sampleRound.srResult
        } : null
      }
    });

  } catch (error) {
    console.error('❌ Verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed',
      error: error.message
    });
  }
});

// Migration Endpoint (temporary - remove after running)
app.post('/api/run-migration', async (req, res) => {
  try {
    const House = require('./models/House');
    const Round = require('./models/Round');

    console.log('🔄 Starting migration...');

    // Migration 1: Add operatingDays to houses (using direct DB query)
    const housesResult = await House.updateMany(
      { operatingDays: { $exists: false } },
      { $set: { operatingDays: [1, 2, 3, 4, 5, 6] } }
    );
    const housesUpdated = housesResult.modifiedCount;

    // Migration 2: Add game mode statuses to rounds
    const rounds = await Round.find({
      $or: [
        { frStatus: { $exists: false } },
        { srStatus: { $exists: false } },
        { forecastStatus: { $exists: false } }
      ]
    }).lean();

    let roundsUpdated = 0;
    const now = new Date();

    for (const round of rounds) {
      const update = {};

      // Calculate frStatus if missing
      if (!round.frStatus) {
        if (round.frResult !== undefined && round.frResult !== null) {
          update.frStatus = 'finished';
        } else if (now >= new Date(round.frDeadline)) {
          update.frStatus = 'live';
        } else {
          update.frStatus = 'pending';
        }
      }

      // Calculate srStatus if missing
      if (!round.srStatus) {
        if (round.srResult !== undefined && round.srResult !== null) {
          update.srStatus = 'finished';
        } else if (now >= new Date(round.srDeadline)) {
          update.srStatus = 'live';
        } else {
          update.srStatus = 'pending';
        }
      }

      // Calculate forecastStatus if missing
      if (!round.forecastStatus) {
        if (round.frResult !== undefined && round.frResult !== null &&
            round.srResult !== undefined && round.srResult !== null) {
          update.forecastStatus = 'finished';
        } else if (now >= new Date(round.frDeadline)) {
          update.forecastStatus = 'live';
        } else {
          update.forecastStatus = 'pending';
        }
      }

      if (Object.keys(update).length > 0) {
        await Round.updateOne({ _id: round._id }, { $set: update });
        roundsUpdated++;
      }
    }

    res.json({
      success: true,
      message: 'Migration completed successfully!',
      housesUpdated,
      roundsUpdated
    });

  } catch (error) {
    console.error('❌ Migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Myteer Betting API',
    version: '1.0.0',
    endpoints: [
      '/api/auth/login',
      '/api/auth/register',
      '/api/houses',
      '/api/rounds',
      '/api/bets',
      '/api/wallet',
      '/api/health'
    ]
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Server Error'
  });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API URL: http://localhost:${PORT}/api`);
});
