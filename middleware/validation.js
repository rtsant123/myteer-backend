const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware to check validation results
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg
      }))
    });
  }
  next();
};

/**
 * Validation rules for creating notification
 */
exports.validateCreateNotification = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ min: 3, max: 100 }).withMessage('Title must be 3-100 characters'),

  body('message')
    .trim()
    .notEmpty().withMessage('Message is required')
    .isLength({ min: 10, max: 500 }).withMessage('Message must be 10-500 characters'),

  body('type')
    .optional()
    .isIn(['win', 'result', 'bonus', 'fomo', 'general'])
    .withMessage('Invalid notification type'),

  body('userId')
    .optional()
    .trim(),

  body('data')
    .optional()
    .isObject().withMessage('Data must be an object'),

  body('scheduledFor')
    .optional()
    .isISO8601().withMessage('Invalid date format for scheduledFor'),

  validate
];

/**
 * Validation rules for marking notification as read
 */
exports.validateMarkAsRead = [
  param('id')
    .isMongoId().withMessage('Invalid notification ID'),

  validate
];

/**
 * Validation rules for deleting notification
 */
exports.validateDeleteNotification = [
  param('id')
    .isMongoId().withMessage('Invalid notification ID'),

  validate
];

/**
 * Validation rules for getting notifications
 */
exports.validateGetNotifications = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),

  query('offset')
    .optional()
    .isInt({ min: 0 }).withMessage('Offset must be a positive number'),

  validate
];

/**
 * Validation rules for getting all notifications (admin)
 */
exports.validateGetAllNotifications = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 500 }).withMessage('Limit must be between 1 and 500'),

  query('offset')
    .optional()
    .isInt({ min: 0 }).withMessage('Offset must be a positive number'),

  query('type')
    .optional()
    .isIn(['win', 'result', 'bonus', 'fomo', 'general'])
    .withMessage('Invalid notification type'),

  validate
];

/**
 * Validation rules for cleanup
 */
exports.validateCleanup = [
  query('days')
    .optional()
    .isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365'),

  validate
];

/**
 * Sanitize notification data before sending to client
 */
exports.sanitizeNotification = (notification) => {
  return {
    id: notification._id || notification.id,
    userId: notification.userId || '',
    title: notification.title,
    message: notification.message,
    type: notification.type,
    data: notification.data || null,
    isRead: notification.isRead || false,
    createdAt: notification.createdAt,
    scheduledFor: notification.scheduledFor || null,
    updatedAt: notification.updatedAt
  };
};

/**
 * Rate limiting for notification creation (prevent spam)
 */
exports.notificationRateLimit = require('express-rate-limit')({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each admin to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many notifications created from this account, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
