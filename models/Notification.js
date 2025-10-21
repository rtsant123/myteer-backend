const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: String,
    default: '', // Empty string for broadcast notifications
    index: true
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [500, 'Message cannot exceed 500 characters']
  },
  type: {
    type: String,
    enum: ['win', 'result', 'bonus', 'fomo', 'general'],
    default: 'general',
    required: true
  },
  data: {
    type: Object,
    default: null // Additional data (bet id, amount, etc.)
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  scheduledFor: {
    type: Date,
    default: null // For scheduled FOMO notifications
  },
  createdBy: {
    type: String,
    default: 'system' // Track which admin created it
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

// Indexes for performance
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ type: 1 });

// Virtual for broadcast check
notificationSchema.virtual('isBroadcast').get(function() {
  return this.userId === '' || this.userId === null;
});

// Instance method to mark as read
notificationSchema.methods.markAsRead = async function() {
  this.isRead = true;
  return await this.save();
};

// Static method to get user notifications (including broadcasts)
notificationSchema.statics.getUserNotifications = async function(userId, limit = 50, offset = 0) {
  return await this.find({
    $or: [
      { userId: userId }, // User-specific notifications
      { userId: '' }      // Broadcast notifications
    ]
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .skip(offset);
};

// Static method to get unread count for user
notificationSchema.statics.getUnreadCount = async function(userId) {
  return await this.countDocuments({
    $or: [
      { userId: userId },
      { userId: '' }
    ],
    isRead: false
  });
};

// Static method to mark all user notifications as read
notificationSchema.statics.markAllAsRead = async function(userId) {
  return await this.updateMany(
    {
      $or: [
        { userId: userId },
        { userId: '' }
      ],
      isRead: false
    },
    {
      $set: { isRead: true }
    }
  );
};

// Static method to create broadcast notification
notificationSchema.statics.createBroadcast = async function(data) {
  return await this.create({
    ...data,
    userId: ''
  });
};

// Middleware to handle scheduled notifications
notificationSchema.pre('save', function(next) {
  // Auto-send notifications scheduled in the past
  if (this.scheduledFor && this.scheduledFor <= new Date()) {
    this.scheduledFor = null; // Clear scheduled time
  }
  next();
});

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
