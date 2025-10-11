const twilio = require('twilio');

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
 * Send OTP via Twilio
 * @param {string} phone - Phone number (with country code, e.g., +919876543210)
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
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      console.error('❌ Twilio credentials not configured');
      console.error('Missing:', {
        accountSid: !accountSid,
        authToken: !authToken,
        fromNumber: !fromNumber
      });
      return {
        success: false,
        message: 'SMS service not configured'
      };
    }

    // Initialize Twilio client
    const client = twilio(accountSid, authToken);

    // Ensure phone number has + prefix
    const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;

    console.log(`📤 Sending OTP to ${formattedPhone} via Twilio...`);

    // Send SMS
    const message = await client.messages.create({
      body: `Your Myteer verification code is: ${otp}. Valid for 10 minutes. Do not share this code with anyone.`,
      from: fromNumber,
      to: formattedPhone
    });

    console.log('✅ Twilio Message sent:', message.sid);

    return {
      success: true,
      message: 'OTP sent successfully'
    };
  } catch (error) {
    console.error('❌ Twilio Error:', error);

    // In case of error, still return success in dev mode for testing
    if (process.env.NODE_ENV === 'development') {
      return {
        success: true,
        message: `OTP sent (DEV MODE due to error: ${otp})`
      };
    }

    // Better error messages
    let errorMessage = 'Failed to send OTP';
    if (error.code === 21211) {
      errorMessage = 'Invalid phone number';
    } else if (error.code === 21608) {
      errorMessage = 'Phone number cannot receive SMS';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      success: false,
      message: errorMessage
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
