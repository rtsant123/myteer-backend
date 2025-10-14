const express = require('express');
const router = express.Router();
const PaymentMethod = require('../models/PaymentMethod');
const { protect, adminOnly } = require('../middleware/auth');

// @route   POST /api/payment-methods/seed
// @desc    Seed initial payment methods (for first-time setup)
// @access  Public (should be protected in production)
router.post('/seed', async (req, res) => {
  try {
    // Check if payment methods already exist
    const existingCount = await PaymentMethod.countDocuments();

    if (existingCount > 0) {
      return res.json({
        success: true,
        message: `${existingCount} payment methods already exist`,
        count: existingCount
      });
    }

    // Create initial payment methods
    const paymentMethods = [
      {
        name: 'PhonePe / Google Pay',
        type: 'UPI',
        details: {
          upiId: 'admin@paytm'
        },
        isActive: true
      },
      {
        name: 'QR Code Payment',
        type: 'QR',
        details: {
          qrCodeUrl: 'https://via.placeholder.com/300x300?text=QR+Code'
        },
        isActive: true
      },
      {
        name: 'Bank Transfer',
        type: 'BANK',
        details: {
          accountHolder: 'Teer Betting Admin',
          accountNumber: '1234567890',
          ifscCode: 'SBIN0001234',
          bankName: 'State Bank of India'
        },
        isActive: true
      }
    ];

    const inserted = await PaymentMethod.insertMany(paymentMethods);

    res.status(201).json({
      success: true,
      message: `Successfully created ${inserted.length} payment methods`,
      count: inserted.length,
      paymentMethods: inserted
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/payment-methods
// @desc    Get all active payment methods
// @access  Public
router.get('/', async (req, res) => {
  try {
    const paymentMethods = await PaymentMethod.find({ isActive: true }).sort({ name: 1 });

    res.json({
      success: true,
      count: paymentMethods.length,
      paymentMethods
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/payment-methods/:id
// @desc    Get payment method by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const paymentMethod = await PaymentMethod.findById(req.params.id);

    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }

    res.json({
      success: true,
      paymentMethod
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/payment-methods
// @desc    Create payment method
// @access  Private/Admin
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { name, type, details } = req.body;

    if (!name || !type) {
      return res.status(400).json({
        success: false,
        message: 'Name and type are required'
      });
    }

    // Validate type
    if (!['UPI', 'BANK', 'QR'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method type'
      });
    }

    const paymentMethod = await PaymentMethod.create({
      name,
      type,
      details: details || {}
    });

    res.status(201).json({
      success: true,
      message: 'Payment method created successfully',
      paymentMethod
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PUT /api/payment-methods/:id
// @desc    Update payment method
// @access  Private/Admin
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const paymentMethod = await PaymentMethod.findById(req.params.id);

    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }

    const { name, type, details, isActive } = req.body;

    // Update fields
    if (name !== undefined) paymentMethod.name = name;
    if (type !== undefined) {
      if (!['UPI', 'BANK', 'QR'].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment method type'
        });
      }
      paymentMethod.type = type;
    }
    if (details !== undefined) paymentMethod.details = details;
    if (isActive !== undefined) paymentMethod.isActive = isActive;

    await paymentMethod.save();

    res.json({
      success: true,
      message: 'Payment method updated successfully',
      paymentMethod
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   DELETE /api/payment-methods/:id
// @desc    Delete payment method (soft delete)
// @access  Private/Admin
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const paymentMethod = await PaymentMethod.findById(req.params.id);

    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }

    // Soft delete by setting isActive to false
    paymentMethod.isActive = false;
    await paymentMethod.save();

    res.json({
      success: true,
      message: 'Payment method deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
