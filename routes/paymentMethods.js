const express = require('express');
const router = express.Router();
const PaymentMethod = require('../models/PaymentMethod');
const { protect, adminOnly } = require('../middleware/auth');

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
