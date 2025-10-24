/**
 * Firebase Cloud Messaging Service
 *
 * This service handles sending push notifications to users via Firebase Cloud Messaging.
 *
 * SETUP REQUIRED:
 * 1. Create Firebase project at https://console.firebase.google.com
 * 2. Download service account key (Project Settings → Service Accounts)
 * 3. Save as: firebase-service-account.json in the project root
 * 4. Install: npm install firebase-admin
 * 5. Add firebase-service-account.json to .gitignore
 */

let admin;
let isFirebaseInitialized = false;

// Try to initialize Firebase Admin
try {
  const adminModule = require('firebase-admin');

  // Try to load service account key
  try {
    const serviceAccount = require('../firebase-service-account.json');

    adminModule.initializeApp({
      credential: adminModule.credential.cert(serviceAccount),
    });

    admin = adminModule;
    isFirebaseInitialized = true;
    console.log('✅ Firebase Admin initialized successfully');
  } catch (keyError) {
    console.warn('⚠️  Firebase service account key not found. Push notifications disabled.');
    console.warn('   To enable: Follow FIREBASE_SETUP_GUIDE.md');
  }
} catch (moduleError) {
  console.warn('⚠️  firebase-admin package not installed. Push notifications disabled.');
  console.warn('   To enable: npm install firebase-admin');
}

/**
 * Send notification to a single user
 * @param {string} userId - User ID (MongoDB ObjectId)
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data payload
 * @returns {Promise<string|null>} Message ID or null
 */
async function sendToUser(userId, title, body, data = {}) {
  if (!isFirebaseInitialized) {
    console.log('📢 [Mock] Would send to user:', userId, title, body);
    return null;
  }

  try {
    const User = require('../models/User');
    const user = await User.findById(userId);

    if (!user || !user.fcmToken) {
      console.log('❌ User has no FCM token');
      return null;
    }

    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        timestamp: new Date().toISOString(),
      },
      token: user.fcmToken,
    };

    const response = await admin.messaging().send(message);
    console.log('✅ Notification sent to user:', userId, '| Message ID:', response);
    return response;
  } catch (error) {
    console.error('❌ Error sending notification to user:', error.message);

    // If token is invalid, remove it from user
    if (error.code === 'messaging/registration-token-not-registered' ||
        error.code === 'messaging/invalid-registration-token') {
      const User = require('../models/User');
      await User.findByIdAndUpdate(userId, { fcmToken: null });
      console.log('🗑️  Removed invalid FCM token for user:', userId);
    }

    return null;
  }
}

/**
 * Send notification to multiple users
 * @param {Array<string>} userIds - Array of user IDs
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data payload
 * @returns {Promise<object|null>} Response with success/failure counts
 */
async function sendToMultipleUsers(userIds, title, body, data = {}) {
  if (!isFirebaseInitialized) {
    console.log('📢 [Mock] Would send to users:', userIds.length, title, body);
    return null;
  }

  try {
    const User = require('../models/User');
    const users = await User.find({
      _id: { $in: userIds },
      fcmToken: { $ne: null }
    });

    const tokens = users.map(u => u.fcmToken);

    if (tokens.length === 0) {
      console.log('❌ No users with FCM tokens found');
      return null;
    }

    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        timestamp: new Date().toISOString(),
      },
      tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`✅ Sent ${response.successCount}/${tokens.length} notifications`);

    // Clean up invalid tokens
    if (response.failureCount > 0) {
      const invalidTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success &&
            (resp.error.code === 'messaging/registration-token-not-registered' ||
             resp.error.code === 'messaging/invalid-registration-token')) {
          invalidTokens.push(tokens[idx]);
        }
      });

      if (invalidTokens.length > 0) {
        await User.updateMany(
          { fcmToken: { $in: invalidTokens } },
          { fcmToken: null }
        );
        console.log(`🗑️  Removed ${invalidTokens.length} invalid FCM tokens`);
      }
    }

    return response;
  } catch (error) {
    console.error('❌ Error sending notifications to multiple users:', error.message);
    return null;
  }
}

/**
 * Send notification to all users via topic
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data payload
 * @returns {Promise<string|null>} Message ID or null
 */
async function sendToAll(title, body, data = {}) {
  if (!isFirebaseInitialized) {
    console.log('📢 [Mock] Would broadcast:', title, body);
    return null;
  }

  try {
    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        timestamp: new Date().toISOString(),
      },
      topic: 'all_users',
    };

    const response = await admin.messaging().send(message);
    console.log('✅ Broadcast notification sent | Message ID:', response);
    return response;
  } catch (error) {
    console.error('❌ Error sending broadcast notification:', error.message);
    return null;
  }
}

/**
 * Send notification to topic subscribers
 * @param {string} topic - Topic name (e.g., 'house_123')
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data payload
 * @returns {Promise<string|null>} Message ID or null
 */
async function sendToTopic(topic, title, body, data = {}) {
  if (!isFirebaseInitialized) {
    console.log('📢 [Mock] Would send to topic:', topic, title, body);
    return null;
  }

  try {
    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        timestamp: new Date().toISOString(),
      },
      topic,
    };

    const response = await admin.messaging().send(message);
    console.log(`✅ Notification sent to topic "${topic}" | Message ID:`, response);
    return response;
  } catch (error) {
    console.error('❌ Error sending notification to topic:', error.message);
    return null;
  }
}

/**
 * Send result notification to users who placed bets on this round
 * @param {object} round - Round object
 * @param {string} resultType - 'FR' or 'SR'
 * @param {number} resultValue - The result number
 */
async function sendResultNotification(round, resultType, resultValue) {
  if (!isFirebaseInitialized) {
    console.log('📢 [Mock] Would send result notification:', resultType, resultValue);
    return;
  }

  try {
    const Bet = require('../models/Bet');
    const House = require('../models/House');

    // Get house name
    const house = await House.findById(round.house);
    if (!house) {
      console.log('❌ House not found for notification');
      return;
    }

    // Get all users who bet on this round
    const bets = await Bet.find({ round: round._id }).populate('user');
    const userIds = [...new Set(bets.map(bet => bet.user?._id?.toString()).filter(Boolean))];

    if (userIds.length === 0) {
      console.log('ℹ️  No users to notify for this result');
      return;
    }

    const title = `${house.name} - ${resultType} Result!`;
    const body = `${resultType} Result: ${resultValue}. Check if you won!`;
    const data = {
      type: 'result',
      houseId: house._id.toString(),
      houseName: house.name,
      roundId: round._id.toString(),
      resultType,
      resultValue: resultValue.toString(),
    };

    await sendToMultipleUsers(userIds, title, body, data);
    console.log(`📢 Result notification sent to ${userIds.length} users`);
  } catch (error) {
    console.error('❌ Error sending result notification:', error.message);
  }
}

module.exports = {
  sendToUser,
  sendToMultipleUsers,
  sendToAll,
  sendToTopic,
  sendResultNotification,
  isFirebaseInitialized,
};
