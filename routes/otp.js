const express = require('express');
const router = express.Router();
const { sendOTP, verifyOTP, resendOTP } = require('../utils/otpService');

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

    // Validate phone number format
    phone = phone.toString().trim();

    // Remove any spaces, dashes, or special characters
    phone = phone.replace(/[\s\-\(\)]/g, '');

    // Add country code if not present (assuming India +91)
    if (!phone.startsWith('91') && !phone.startsWith('+91')) {
      // If it's 10 digits, assume India
      if (phone.length === 10) {
        phone = '91' + phone;
      }
    }

    // Remove + if present
    phone = phone.replace('+', '');

    // Validate final format (should be like 919876543210)
    if (phone.length < 10 || phone.length > 15) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
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

    // Normalize phone number (same as send)
    phone = phone.toString().trim().replace(/[\s\-\(\)]/g, '');
    if (!phone.startsWith('91') && !phone.startsWith('+91')) {
      if (phone.length === 10) {
        phone = '91' + phone;
      }
    }
    phone = phone.replace('+', '');

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

    // Normalize phone number
    phone = phone.toString().trim().replace(/[\s\-\(\)]/g, '');
    if (!phone.startsWith('91') && !phone.startsWith('+91')) {
      if (phone.length === 10) {
        phone = '91' + phone;
      }
    }
    phone = phone.replace('+', '');

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
