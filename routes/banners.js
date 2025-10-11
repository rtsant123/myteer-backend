const express = require('express');
const router = express.Router();
const Banner = require('../models/Banner');
const { protect, adminOnly } = require('../middleware/auth');

// @route   GET /api/banners
// @desc    Get all active banners (public)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const banners = await Banner.find({ isActive: true }).sort({ order: 1 });

    res.json({
      success: true,
      banners
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/banners
// @desc    Create banner
// @access  Private/Admin
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { title, imageUrl, description, link, order } = req.body;

    if (!title || !imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Title and image URL are required'
      });
    }

    const banner = await Banner.create({
      title,
      imageUrl,
      description,
      link,
      order: order || 0
    });

    res.status(201).json({
      success: true,
      message: 'Banner created successfully',
      banner
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PUT /api/banners/:id
// @desc    Update banner
// @access  Private/Admin
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    const { title, imageUrl, description, link, order, isActive } = req.body;

    if (title) banner.title = title;
    if (imageUrl) banner.imageUrl = imageUrl;
    if (description !== undefined) banner.description = description;
    if (link !== undefined) banner.link = link;
    if (order !== undefined) banner.order = order;
    if (isActive !== undefined) banner.isActive = isActive;

    await banner.save();

    res.json({
      success: true,
      message: 'Banner updated successfully',
      banner
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   DELETE /api/banners/:id
// @desc    Delete banner
// @access  Private/Admin
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    await banner.deleteOne();

    res.json({
      success: true,
      message: 'Banner deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/banners/admin/all
// @desc    Get all banners (including inactive) for admin
// @access  Private/Admin
router.get('/admin/all', protect, adminOnly, async (req, res) => {
  try {
    const banners = await Banner.find().sort({ order: 1 });

    res.json({
      success: true,
      banners
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
