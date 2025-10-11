const axios = require('axios');

// In-memory OTP storage
// NOTE: For production with multiple servers, use Redis instead
const otpStore = new Map();

/**
 * Generate random 6-digit OTP
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send OTP via MSG91
 * @param {string} phone - Phone number (with country code, e.g., 919876543210)
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function sendOTP(phone) {
  const otp = generateOTP();

  // Store OTP with 10-minute expiry
  otpStore.set(phone, {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    attempts: 0
  });

  console.log(`📱 Generated OTP for ${phone}: ${otp}`);

  // Check if running in development mode
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔧 DEV MODE: OTP for ${phone} is ${otp}`);
    return {
      success: true,
      message: `OTP sent (DEV MODE: ${otp})`
    };
  }

  try {
    const authKey = process.env.MSG91_AUTH_KEY;

    if (!authKey) {
      console.error('❌ MSG91_AUTH_KEY not configured');
      return {
        success: false,
        message: 'SMS service not configured'
      };
    }

    // MSG91 OTP Send API
    const url = 'https://control.msg91.com/api/v5/otp';

    const payload = {
      template_id: process.env.MSG91_TEMPLATE_ID || '123456789012345678901234', // You'll need to create template
      mobile: phone,
      authkey: authKey,
      otp: otp,
      otp_expiry: 10 // 10 minutes
    };

    console.log(`📤 Sending OTP to ${phone} via MSG91...`);

    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ MSG91 Response:', response.data);

    if (response.data.type === 'success' || response.status === 200) {
      return {
        success: true,
        message: 'OTP sent successfully'
      };
    } else {
      console.error('❌ MSG91 Error:', response.data);
      return {
        success: false,
        message: 'Failed to send OTP'
      };
    }
  } catch (error) {
    console.error('❌ OTP Send Error:', error.response?.data || error.message);

    // In case of error, still return success in dev mode for testing
    if (process.env.NODE_ENV === 'development') {
      return {
        success: true,
        message: `OTP sent (DEV MODE due to error: ${otp})`
      };
    }

    return {
      success: false,
      message: 'Failed to send OTP'
    };
  }
}

/**
 * Verify OTP
 * @param {string} phone - Phone number
 * @param {string} otp - OTP entered by user
 * @returns {{success: boolean, message: string}}
 */
function verifyOTP(phone, otp) {
  const stored = otpStore.get(phone);

  if (!stored) {
    console.log(`❌ OTP not found for ${phone}`);
    return {
      success: false,
      message: 'OTP not found or expired. Please request a new OTP.'
    };
  }

  // Check expiry
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(phone);
    console.log(`⏰ OTP expired for ${phone}`);
    return {
      success: false,
      message: 'OTP expired. Please request a new OTP.'
    };
  }

  // Check attempts (max 3)
  if (stored.attempts >= 3) {
    otpStore.delete(phone);
    console.log(`🚫 Too many attempts for ${phone}`);
    return {
      success: false,
      message: 'Too many failed attempts. Please request a new OTP.'
    };
  }

  // Verify OTP
  if (stored.otp !== otp) {
    stored.attempts += 1;
    console.log(`❌ Invalid OTP for ${phone} (attempt ${stored.attempts}/3)`);
    return {
      success: false,
      message: `Invalid OTP. ${3 - stored.attempts} attempts remaining.`
    };
  }

  // OTP verified successfully
  otpStore.delete(phone);
  console.log(`✅ OTP verified for ${phone}`);
  return {
    success: true,
    message: 'OTP verified successfully'
  };
}

/**
 * Resend OTP (same as sendOTP but replaces existing OTP)
 */
async function resendOTP(phone) {
  // Delete existing OTP
  otpStore.delete(phone);

  // Send new OTP
  return await sendOTP(phone);
}

/**
 * Clean up expired OTPs (run periodically)
 */
function cleanupExpiredOTPs() {
  const now = Date.now();
  let cleaned = 0;

  for (const [phone, data] of otpStore.entries()) {
    if (now > data.expiresAt) {
      otpStore.delete(phone);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} expired OTPs`);
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredOTPs, 5 * 60 * 1000);

module.exports = {
  sendOTP,
  verifyOTP,
  resendOTP
};
