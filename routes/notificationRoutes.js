const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  getAllNotifications,
  getNotificationStats,
  cleanupNotifications
} = require('../controllers/notificationController');

// Import middleware
const { protect, adminOnly } = require('../middleware/auth');
const {
  validateCreateNotification,
  validateMarkAsRead,
  validateDeleteNotification,
  validateGetNotifications,
  validateGetAllNotifications,
  validateCleanup,
  notificationRateLimit
} = require('../middleware/validation');

// =====================
// USER ROUTES
// =====================

/**
 * @route   GET /api/notifications
 * @desc    Get user's notifications (including broadcasts)
 * @access  Private
 */
router.get('/', protect, validateGetNotifications, getNotifications);

/**
 * @route   POST /api/notifications/:id/read
 * @desc    Mark specific notification as read
 * @access  Private
 */
router.post('/:id/read', protect, validateMarkAsRead, markAsRead);

/**
 * @route   POST /api/notifications/read-all
 * @desc    Mark all user notifications as read
 * @access  Private
 */
router.post('/read-all', protect, markAllAsRead);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete specific notification
 * @access  Private
 */
router.delete('/:id', protect, validateDeleteNotification, deleteNotification);

// =====================
// ADMIN ROUTES
// =====================

/**
 * @route   POST /api/notifications
 * @desc    Create notification (broadcast or targeted)
 * @access  Private/Admin
 */
router.post(
  '/',
  protect,
  adminOnly,
  notificationRateLimit,
  validateCreateNotification,
  createNotification
);

/**
 * @route   GET /api/notifications/all
 * @desc    Get all notifications with filters
 * @access  Private/Admin
 */
router.get('/all', protect, adminOnly, validateGetAllNotifications, getAllNotifications);

/**
 * @route   GET /api/notifications/stats
 * @desc    Get notification statistics
 * @access  Private/Admin
 */
router.get('/stats', protect, adminOnly, getNotificationStats);

/**
 * @route   DELETE /api/notifications/cleanup
 * @desc    Delete old read notifications
 * @access  Private/Admin
 */
router.delete('/cleanup', protect, adminOnly, validateCleanup, cleanupNotifications);

module.exports = router;
