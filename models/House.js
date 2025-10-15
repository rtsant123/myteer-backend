const mongoose = require('mongoose');

const houseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  location: String,
  frDirectRate: {
    type: Number,
    default: 80
  },
  frHouseRate: {
    type: Number,
    default: 16
  },
  frEndingRate: {
    type: Number,
    default: 16
  },
  srDirectRate: {
    type: Number,
    default: 70
  },
  srHouseRate: {
    type: Number,
    default: 14
  },
  srEndingRate: {
    type: Number,
    default: 14
  },
  forecastDirectRate: {
    type: Number,
    default: 400
  },
  forecastHouseRate: {
    type: Number,
    default: 40
  },
  forecastEndingRate: {
    type: Number,
    default: 40
  },
  // Deadline times for betting (in IST)
  frDeadlineTime: {
    type: String,
    default: '13:00', // 1:00 PM IST
    required: true
  },
  srDeadlineTime: {
    type: String,
    default: '17:00', // 5:00 PM IST
    required: true
  },
  forecastDeadlineTime: {
    type: String,
    default: '13:00', // Same as FR by default
    required: true
  },
  // Auto-create rounds
  autoCreateRounds: {
    type: Boolean,
    default: true
  },
  // Days when house operates (0=Sunday, 1=Monday, ..., 6=Saturday)
  // Default: Monday to Saturday (skip Sunday)
  operatingDays: {
    type: [Number],
    default: [1, 2, 3, 4, 5, 6], // Monday-Saturday
    validate: {
      validator: function(v) {
        return v.every(day => day >= 0 && day <= 6);
      },
      message: 'Operating days must be between 0 (Sunday) and 6 (Saturday)'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('House', houseSchema);
