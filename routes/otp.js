const express = require('express');
const router = express.Router();
const { sendOTP, verifyOTP, resendOTP } = require('../utils/otpService');
const User = require('../models/User');

// Normalize phone number for international support
// Keeps country code, removes spaces/dashes/parentheses, removes + sign for storage
const normalizePhone = (phone) => {
  if (!phone) return '';

  // Convert to string and trim
  phone = phone.toString().trim();

  // Remove spaces, dashes, and parentheses
  phone = phone.replace(/[\s\-\(\)]/g, '');

  // Remove + sign (we store without it, but keep the country code)
  phone = phone.replace('+', '');

  // Legacy support: If it's a 10-digit number without country code, assume Indian
  if (phone.length === 10 && /^[6-9][0-9]{9}$/.test(phone)) {
    phone = '91' + phone;
  }

  return phone;
};

// @route   POST /api/otp/send
// @desc    Send OTP to phone number
// @access  Public
router.post('/send', async (req, res) => {
  try {
    let { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Normalize phone number (supports international numbers)
    phone = normalizePhone(phone);

    // Validate final format (should be like 919876543210)
    if (phone.length < 10 || phone.length > 15) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }

    // Check if user already exists BEFORE sending OTP
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      console.log(`❌ Registration attempt for existing user: ${phone}`);
      return res.status(400).json({
        success: false,
        message: 'This phone number is already registered. Please login instead.'
      });
    }

    console.log(`📞 Sending OTP to: ${phone}`);

    const result = await sendOTP(phone);

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('OTP Send Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP'
    });
  }
});

// @route   POST /api/otp/verify
// @desc    Verify OTP
// @access  Public
router.post('/verify', async (req, res) => {
  try {
    let { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and OTP are required'
      });
    }

    // Normalize phone number (supports international numbers)
    phone = normalizePhone(phone);

    // Validate OTP format
    otp = otp.toString().trim();
    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: 'OTP must be 6 digits'
      });
    }

    console.log(`🔐 Verifying OTP for: ${phone}`);

    const result = verifyOTP(phone, otp);

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('OTP Verify Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify OTP'
    });
  }
});

// @route   POST /api/otp/resend
// @desc    Resend OTP
// @access  Public
router.post('/resend', async (req, res) => {
  try {
    let { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Normalize phone number (supports international numbers)
    phone = normalizePhone(phone);

    console.log(`🔄 Resending OTP to: ${phone}`);

    const result = await resendOTP(phone);

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('OTP Resend Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend OTP'
    });
  }
});

module.exports = router;
