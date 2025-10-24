/**
 * Simple test script to verify Firebase Admin is working
 */

const pushNotificationService = require('./services/pushNotificationService');

console.log('\n🔥 Testing Firebase Admin Setup...\n');

if (pushNotificationService.isFirebaseInitialized) {
  console.log('✅ Firebase Admin initialized successfully!');
  console.log('✅ Push notifications are ENABLED');
  console.log('');
  console.log('📢 Backend can now send notifications when:');
  console.log('   - Results are published');
  console.log('   - Admin sends custom notifications');
  console.log('');
  console.log('🎯 Next step: Deploy backend to Railway');
} else {
  console.log('❌ Firebase Admin not initialized');
  console.log('');
  console.log('⚠️  Possible issues:');
  console.log('   1. firebase-service-account.json not found');
  console.log('   2. Invalid JSON in service account file');
  console.log('   3. firebase-admin package not installed');
  console.log('');
  console.log('💡 Push notifications will work in mock mode (logs only)');
}

console.log('\n✨ Test complete!\n');

process.exit(0);
