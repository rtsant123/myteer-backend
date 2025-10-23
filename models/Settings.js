const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  description: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Helper method to get setting value
settingsSchema.statics.get = async function(key, defaultValue = null) {
  const setting = await this.findOne({ key });
  return setting ? setting.value : defaultValue;
};

// Helper method to set setting value
settingsSchema.statics.set = async function(key, value, description = '') {
  return await this.findOneAndUpdate(
    { key },
    { value, description },
    { upsert: true, new: true }
  );
};

module.exports = mongoose.model('Settings', settingsSchema);
