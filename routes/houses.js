const express = require('express');
const router = express.Router();
const House = require('../models/House');
const { protect, adminOnly } = require('../middleware/auth');

// @route   GET /api/houses
// @desc    Get all houses (or active only)
// @access  Public
// @query   all=true - Get all houses including inactive (for admin)
router.get('/', async (req, res) => {
  try {
    // If all=true query parameter is present, get all houses
    // Otherwise, only get active houses
    const filter = req.query.all === 'true' ? {} : { isActive: true };
    const houses = await House.find(filter).sort({ name: 1 });

    res.json({
      success: true,
      count: houses.length,
      houses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/houses/:id
// @desc    Get house by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const house = await House.findById(req.params.id);

    if (!house) {
      return res.status(404).json({
        success: false,
        message: 'House not found'
      });
    }

    res.json({
      success: true,
      house
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/houses
// @desc    Create house
// @access  Private/Admin
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const {
      name,
      location,
      frDirectRate,
      frHouseRate,
      frEndingRate,
      srDirectRate,
      srHouseRate,
      srEndingRate,
      forecastDirectRate,
      forecastHouseRate,
      forecastEndingRate,
      deadlineTime,
      autoCreateRounds,
      operatingDays,
      isActive
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'House name is required'
      });
    }

    if (!deadlineTime) {
      return res.status(400).json({
        success: false,
        message: 'Deadline time is required'
      });
    }

    const house = await House.create({
      name,
      location,
      frDirectRate,
      frHouseRate,
      frEndingRate,
      srDirectRate,
      srHouseRate,
      srEndingRate,
      forecastDirectRate,
      forecastHouseRate,
      forecastEndingRate,
      deadlineTime,
      autoCreateRounds: autoCreateRounds !== undefined ? autoCreateRounds : true,
      operatingDays: operatingDays || [1, 2, 3, 4, 5, 6], // Mon-Sat by default (0=Sunday excluded)
      isActive: isActive !== undefined ? isActive : true
    });

    res.status(201).json({
      success: true,
      message: 'House created successfully',
      house
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PUT /api/houses/:id
// @desc    Update house
// @access  Private/Admin
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const house = await House.findById(req.params.id);

    if (!house) {
      return res.status(404).json({
        success: false,
        message: 'House not found'
      });
    }

    const {
      name,
      location,
      frDirectRate,
      frHouseRate,
      frEndingRate,
      srDirectRate,
      srHouseRate,
      srEndingRate,
      forecastDirectRate,
      forecastHouseRate,
      forecastEndingRate,
      deadlineTime,
      autoCreateRounds,
      operatingDays,
      isActive
    } = req.body;

    // Update fields
    if (name !== undefined) house.name = name;
    if (location !== undefined) house.location = location;
    if (frDirectRate !== undefined) house.frDirectRate = frDirectRate;
    if (frHouseRate !== undefined) house.frHouseRate = frHouseRate;
    if (frEndingRate !== undefined) house.frEndingRate = frEndingRate;
    if (srDirectRate !== undefined) house.srDirectRate = srDirectRate;
    if (srHouseRate !== undefined) house.srHouseRate = srHouseRate;
    if (srEndingRate !== undefined) house.srEndingRate = srEndingRate;
    if (forecastDirectRate !== undefined) house.forecastDirectRate = forecastDirectRate;
    if (forecastHouseRate !== undefined) house.forecastHouseRate = forecastHouseRate;
    if (forecastEndingRate !== undefined) house.forecastEndingRate = forecastEndingRate;
    if (deadlineTime !== undefined) house.deadlineTime = deadlineTime;
    if (autoCreateRounds !== undefined) house.autoCreateRounds = autoCreateRounds;
    if (operatingDays !== undefined) house.operatingDays = operatingDays;
    if (isActive !== undefined) house.isActive = isActive;

    await house.save();

    res.json({
      success: true,
      message: 'House updated successfully',
      house
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   DELETE /api/houses/:id
// @desc    Delete house (permanent delete)
// @access  Private/Admin
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const house = await House.findByIdAndDelete(req.params.id);

    if (!house) {
      return res.status(404).json({
        success: false,
        message: 'House not found'
      });
    }

    res.json({
      success: true,
      message: 'House deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
