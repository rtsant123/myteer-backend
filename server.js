require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// =============================================================================
// ENVIRONMENT VARIABLE VALIDATION (CRITICAL SECURITY)
// =============================================================================
const requiredEnvVars = [
  'MONGO_URI',
  'JWT_SECRET'
];

const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missing.length > 0) {
  console.error(`❌ FATAL: Missing required environment variables: ${missing.join(', ')}`);
  console.error('⚠️  Set these in Railway/Heroku environment variables before deploying!');
  process.exit(1);
}

// Warn about optional but recommended vars
const recommendedVars = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'];
const missingRecommended = recommendedVars.filter(envVar => !process.env[envVar]);
if (missingRecommended.length > 0) {
  console.warn(`⚠️  WARNING: Missing optional environment variables: ${missingRecommended.join(', ')}`);
  console.warn('   OTP functionality will not work without Twilio credentials.');
}

const app = express();

// =============================================================================
// SECURITY MIDDLEWARE (CRITICAL)
// =============================================================================

// 1. Helmet - Security headers (XSS, clickjacking, MIME sniffing protection)
app.use(helmet({
  contentSecurityPolicy: false, // Disable if using inline scripts
  crossOriginEmbedderPolicy: false
}));

// 2. CORS - Restrict which domains can access your API
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman)
    if (!origin) return callback(null, true);

    const allowedOrigins = process.env.NODE_ENV === 'production'
      ? [
          'https://myteer-backend-production.up.railway.app', // Your backend domain
          // Add your frontend domain here when you have one:
          // 'https://yourdomain.com'
        ]
      : ['http://localhost:3000', 'http://localhost:8080'];

    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// 3. Request size limits - Prevent memory exhaustion attacks
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Rate Limiting - Prevent brute force and API abuse
// IMPORTANT: Custom handler to ALWAYS return JSON (not HTML!)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per IP per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  // Skip registration and OTP endpoints from general rate limiting
  skip: (req) => {
    const path = req.path;
    return path.includes('/auth/register') || path.includes('/otp');
  },
  // Force JSON response (prevents HTML error)
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later'
    });
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 login attempts per 15 mins
  skipSuccessfulRequests: true, // Don't count successful logins
  // Force JSON response (prevents HTML error)
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts, try again in 15 minutes'
    });
  }
});

// =============================================================================
// AUTO-UPDATE ROUND STATUSES MIDDLEWARE
// =============================================================================
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

// =============================================================================
// MONGODB CONNECTION
// =============================================================================
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000 // Fail fast if can't connect
})
.then(() => {
  console.log('✅ MongoDB Connected');

  // Initialize round scheduler (auto-lifecycle + auto-creation)
  const { initScheduler } = require('./services/roundScheduler');
  initScheduler();
})
.catch(err => {
  console.error('❌ MongoDB Connection Error:', err);
  console.error('   Make sure MONGO_URI is set correctly in environment variables');
  process.exit(1); // Don't run server if DB is down
});

// =============================================================================
// APPLY RATE LIMITERS (Before routes!)
// =============================================================================
// Apply login limiter only to login endpoint
app.use('/api/auth/login', authLimiter);

// Apply general limiter to MOST routes (registration/OTP will bypass via skip function)
app.use('/api/', generalLimiter);

// =============================================================================
// ROUTES
// =============================================================================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/otp', require('./routes/otp')); // OTP routes (send, verify, resend)
app.use('/api/houses', require('./routes/houses'));
app.use('/api/rounds', require('./routes/rounds'));
app.use('/api/bets', require('./routes/bets'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/payment-methods', require('./routes/paymentMethods'));
app.use('/api/deposits', require('./routes/deposits'));
app.use('/api/withdrawals', require('./routes/withdrawals'));
app.use('/api/banners', require('./routes/banners'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/referrals', require('./routes/referrals'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/app-version', require('./routes/appVersion'));

// =============================================================================
// HEALTH CHECK & ROOT ENDPOINT
// =============================================================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Myteer API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Myteer Betting API',
    version: '1.0.3',
    status: 'online',
    documentation: '/api/health'
  });
});

// =============================================================================
// ADMIN-ONLY UTILITY ENDPOINTS (PROTECTED)
// =============================================================================
const { protect, adminOnly } = require('./middleware/auth');

// Manual trigger for round status updates (admin only)
app.post('/api/admin/update-statuses', protect, adminOnly, async (req, res) => {
  try {
    const { updateRoundStatuses } = require('./services/roundScheduler');
    await updateRoundStatuses();
    res.json({ success: true, message: 'Round statuses updated successfully' });
  } catch (error) {
    console.error('❌ Error updating round statuses:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Verification endpoint - Check migration status (admin only)
app.get('/api/admin/verify-migration', protect, adminOnly, async (req, res) => {
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

// =============================================================================
// 404 HANDLER - Return JSON for all unmatched routes (NOT HTML!)
// =============================================================================
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Endpoint not found: ${req.method} ${req.path}`
  });
});

// =============================================================================
// ERROR HANDLER (MUST BE LAST)
// =============================================================================
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);

  // Don't leak error details in production
  const errorMessage = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  res.status(err.status || 500).json({
    success: false,
    message: errorMessage
  });
});

// =============================================================================
// START SERVER
// =============================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 Security: Helmet enabled, CORS restricted, Rate limiting active`);
  console.log(`📊 API Health Check: http://localhost:${PORT}/api/health`);
});
// Trigger Railway redeploy
