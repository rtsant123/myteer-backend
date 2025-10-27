const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    default: ''
  },
  balance: {
    type: Number,
    default: 0
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true  // Allows null values to not conflict with unique constraint
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  fcmToken: {
    type: String,
    default: null
  },
  permissions: {
    canUpdateResults: {
      type: Boolean,
      default: true  // Default full permissions for existing admins
    },
    canApprovePayments: {
      type: Boolean,
      default: true
    },
    canCreateRounds: {
      type: Boolean,
      default: true
    },
    canCreateHouses: {
      type: Boolean,
      default: true
    },
    canAccessAnalytics: {
      type: Boolean,
      default: true
    },
    canAccessChatSupport: {
      type: Boolean,
      default: true
    },
    canManageUsers: {
      type: Boolean,
      default: true
    },
    canManageAppVersion: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Indexes for performance (applied automatically by Mongoose)
userSchema.index({ phone: 1 }, { unique: true }); // Unique index on phone
userSchema.index({ isAdmin: 1 }); // Fast admin lookups
userSchema.index({ createdAt: -1 }); // Fast queries by registration date
userSchema.index({ balance: -1 }); // Fast queries by balance (for leaderboards)
userSchema.index({ referredBy: 1 }); // Fast referral queries

module.exports = mongoose.model('User', userSchema);
