const jwt = require('jsonwebtoken');
const User = require('../models/User');

// CRITICAL SECURITY: JWT_SECRET must be set in environment variables
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ FATAL ERROR: JWT_SECRET environment variable is not set!');
  console.error('   This is a critical security issue. Set JWT_SECRET in Railway/Heroku environment variables.');
  console.error('   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  process.exit(1);
}

exports.protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'User role not authorized'
      });
    }
    next();
  };
};

exports.adminOnly = (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

// Permission-based access control middleware
exports.requirePermission = (permissionKey) => {
  return (req, res, next) => {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // If no role/permissions object exists (old admins), grant access (backward compatibility)
    // Check both req.user.role and req.user.permissions for backward compatibility
    if (!req.user.role && !req.user.permissions) {
      // Old admin without permissions object - grant full access
      next();
      return;
    }

    // Check if user has the specific permission (check both role and permissions objects)
    const hasPermission = (req.user.role && req.user.role[permissionKey]) ||
                          (req.user.permissions && req.user.permissions[permissionKey]);

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: `Permission denied: ${permissionKey} required`
      });
    }

    next();
  };
};
