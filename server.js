require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Myteer API is running' });
});

// Migration Endpoint (temporary - remove after running)
app.post('/api/run-migration', async (req, res) => {
  try {
    const House = require('./models/House');
    const Round = require('./models/Round');

    console.log('🔄 Starting migration...');

    // Migration 1: Add operatingDays to houses
    const houses = await House.find({});
    let housesUpdated = 0;

    for (const house of houses) {
      if (!house.operatingDays || house.operatingDays.length === 0) {
        house.operatingDays = [1, 2, 3, 4, 5, 6]; // Monday-Saturday
        await house.save();
        housesUpdated++;
      }
    }

    // Migration 2: Add game mode statuses to rounds
    const rounds = await Round.find({});
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
