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
  forecastRate: {
    type: Number,
    default: 400
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('House', houseSchema);
