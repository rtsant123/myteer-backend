const Notification = require('../models/Notification');
const User = require('../models/User'); // Assuming you have a User model

/**
 * @desc    Get user's notifications (including broadcasts)
 * @route   GET /api/notifications
 * @access  Private
 */
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id; // Adjust based on your auth implementation
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const notifications = await Notification.getUserNotifications(userId, limit, offset);
    const total = await Notification.countDocuments({
      $or: [
        { userId: userId },
        { userId: '' }
      ]
    });

    res.status(200).json({
      success: true,
      count: notifications.length,
      total: total,
      notifications: notifications.map(n => ({
        id: n._id,
        userId: n.userId,
        title: n.title,
        message: n.message,
        type: n.type,
        data: n.data,
        isRead: n.isRead,
        createdAt: n.createdAt,
        scheduledFor: n.scheduledFor
      }))
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
};

/**
 * @desc    Mark notification as read
 * @route   POST /api/notifications/:id/read
 * @access  Private
 */
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId || req.user.id;

    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Check if user owns this notification or it's a broadcast
    if (notification.userId !== userId && notification.userId !== '') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this notification'
      });
    }

    await notification.markAsRead();

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      notification: {
        id: notification._id,
        isRead: notification.isRead
      }
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
};

/**
 * @desc    Mark all notifications as read for user
 * @route   POST /api/notifications/read-all
 * @access  Private
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;

    const result = await Notification.markAllAsRead(userId);

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      count: result.modifiedCount
    });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all as read',
      error: error.message
    });
  }
};

/**
 * @desc    Delete notification
 * @route   DELETE /api/notifications/:id
 * @access  Private
 */
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId || req.user.id;

    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Check if user owns this notification or it's a broadcast
    if (notification.userId !== userId && notification.userId !== '') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this notification'
      });
    }

    await Notification.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message
    });
  }
};

/**
 * @desc    Create notification (Admin only)
 * @route   POST /api/notifications
 * @access  Private/Admin
 */
exports.createNotification = async (req, res) => {
  try {
    const { userId, title, message, type, data, scheduledFor } = req.body;
    const createdBy = req.user.userId || req.user.id;

    // Validate required fields
    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }

    // If userId is provided, verify user exists
    if (userId && userId !== '') {
      const userExists = await User.findOne({
        $or: [
          { userId: userId },
          { phoneNumber: userId }
        ]
      });

      if (!userExists) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
    }

    const notificationData = {
      userId: userId || '',
      title,
      message,
      type: type || 'general',
      data,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      createdBy
    };

    const notification = await Notification.create(notificationData);

    // Log admin action
    console.log(`Admin ${createdBy} created notification: ${notification._id}`);

    res.status(201).json({
      success: true,
      message: userId ? 'Notification sent to user' : 'Broadcast notification sent',
      notification: {
        id: notification._id,
        userId: notification.userId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        createdAt: notification.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create notification',
      error: error.message
    });
  }
};

/**
 * @desc    Get all notifications (Admin only)
 * @route   GET /api/notifications/all
 * @access  Private/Admin
 */
exports.getAllNotifications = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const type = req.query.type;

    const query = {};
    if (type) {
      query.type = type;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset);

    const total = await Notification.countDocuments(query);

    res.status(200).json({
      success: true,
      count: notifications.length,
      total: total,
      notifications: notifications.map(n => ({
        id: n._id,
        userId: n.userId,
        title: n.title,
        message: n.message,
        type: n.type,
        data: n.data,
        isRead: n.isRead,
        createdAt: n.createdAt,
        createdBy: n.createdBy,
        isBroadcast: n.userId === ''
      }))
    });
  } catch (error) {
    console.error('Error fetching all notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
};

/**
 * @desc    Get notification statistics (Admin only)
 * @route   GET /api/notifications/stats
 * @access  Private/Admin
 */
exports.getNotificationStats = async (req, res) => {
  try {
    const totalNotifications = await Notification.countDocuments();
    const broadcastCount = await Notification.countDocuments({ userId: '' });
    const individualCount = totalNotifications - broadcastCount;
    const unreadCount = await Notification.countDocuments({ isRead: false });

    const typeBreakdown = await Notification.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      stats: {
        total: totalNotifications,
        broadcast: broadcastCount,
        individual: individualCount,
        unread: unreadCount,
        byType: typeBreakdown.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
};

/**
 * @desc    Delete old read notifications (Cleanup job)
 * @route   DELETE /api/notifications/cleanup
 * @access  Private/Admin
 */
exports.cleanupNotifications = async (req, res) => {
  try {
    const daysOld = parseInt(req.query.days) || 30;
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - daysOld);

    const result = await Notification.deleteMany({
      isRead: true,
      createdAt: { $lt: dateThreshold }
    });

    res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} old notifications`,
      count: result.deletedCount
    });
  } catch (error) {
    console.error('Error cleaning up notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup notifications',
      error: error.message
    });
  }
};
