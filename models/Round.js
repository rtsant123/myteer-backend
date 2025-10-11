const mongoose = require('mongoose');

const roundSchema = new mongoose.Schema({
  house: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'House',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  frOpenTime: Date,
  frCloseTime: Date,
  srOpenTime: Date,
  srCloseTime: Date,
  frResult: {
    type: Number,
    min: 0,
    max: 99
  },
  srResult: {
    type: Number,
    min: 0,
    max: 99
  },
  status: {
    type: String,
    enum: ['open', 'fr_closed', 'closed', 'completed'],
    default: 'open'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Round', roundSchema);
