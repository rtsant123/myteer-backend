const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const { adminOnly } = require('../middleware/auth');

// Public endpoint - Check for app updates
router.get('/check', async (req, res) => {
  try {
    const currentVersion = req.query.version; // e.g., "1.0.2"
    
    if (!currentVersion) {
      return res.status(400).json({
        success: false,
        message: 'Version parameter required'
      });
    }

    // Get latest version info from settings
    const latestVersion = await Settings.get('app_version_latest', '1.0.2');
    const updateMessage = await Settings.get('app_version_message', 'A new version is available!');
    const isMandatory = await Settings.get('app_version_mandatory', false);
    const downloadUrl = await Settings.get('app_version_download_url', '');

    // Compare versions
    const needsUpdate = compareVersions(currentVersion, latestVersion) < 0;

    res.json({
      success: true,
      needsUpdate,
      latestVersion,
      currentVersion,
      updateMessage,
      isMandatory,
      downloadUrl
    });
  } catch (error) {
    console.error('Version check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check version'
    });
  }
});

// Admin endpoint - Get version settings
router.get('/settings', adminOnly, async (req, res) => {
  try {
    const latestVersion = await Settings.get('app_version_latest', '1.0.2');
    const updateMessage = await Settings.get('app_version_message', 'A new version is available!');
    const isMandatory = await Settings.get('app_version_mandatory', false);
    const downloadUrl = await Settings.get('app_version_download_url', '');

    res.json({
      success: true,
      settings: {
        latestVersion,
        updateMessage,
        isMandatory,
        downloadUrl
      }
    });
  } catch (error) {
    console.error('Get version settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get version settings'
    });
  }
});

// Admin endpoint - Update version settings
router.put('/settings', adminOnly, async (req, res) => {
  try {
    const { latestVersion, updateMessage, isMandatory, downloadUrl } = req.body;

    if (!latestVersion) {
      return res.status(400).json({
        success: false,
        message: 'Latest version is required'
      });
    }

    // Update all version settings
    await Settings.set('app_version_latest', latestVersion, 'Latest app version');
    await Settings.set('app_version_message', updateMessage || 'A new version is available!', 'Update message');
    await Settings.set('app_version_mandatory', isMandatory || false, 'Is update mandatory');
    await Settings.set('app_version_download_url', downloadUrl || '', 'APK download URL');

    res.json({
      success: true,
      message: 'Version settings updated successfully',
      settings: {
        latestVersion,
        updateMessage,
        isMandatory,
        downloadUrl
      }
    });
  } catch (error) {
    console.error('Update version settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update version settings'
    });
  }
});

// Helper function to compare versions
// Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    
    if (num1 < num2) return -1;
    if (num1 > num2) return 1;
  }
  
  return 0;
}

module.exports = router;
