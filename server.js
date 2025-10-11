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

  // Initialize auto-round creation scheduler
  const { scheduleAutoRoundCreation } = require('./utils/roundScheduler');
  scheduleAutoRoundCreation();
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

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Myteer API is running' });
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
