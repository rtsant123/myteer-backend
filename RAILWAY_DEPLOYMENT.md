# 🚀 Railway Deployment Instructions

**Status:** Backend code pushed to GitHub ✅
**Railway:** Will auto-deploy from GitHub push
**Action Required:** Add Firebase environment variable

---

## ⚠️ CRITICAL STEP: Add Firebase Service Account to Railway

Push notifications will **NOT work** until you add the Firebase service account to Railway as an environment variable.

### Step 1: Copy Firebase Service Account Content

The file is located at:
```
C:\Users\MSP001\AndroidStudioProjects\myteer_backend\firebase-service-account.json
```

**Copy the ENTIRE content** of this file (it's JSON format with your private key).

### Step 2: Add to Railway Environment Variables

1. Go to **Railway Dashboard**: https://railway.app
2. Select your **myteer-backend** project
3. Click on the **Variables** tab
4. Click **+ New Variable**
5. Set variable name: `FIREBASE_SERVICE_ACCOUNT`
6. Paste the **entire JSON content** from firebase-service-account.json as the value
7. Click **Add**
8. Railway will automatically redeploy with the new variable

---

## 📋 What Happens Next:

### Automatic Railway Deployment:
✅ Railway detects GitHub push
✅ Pulls latest code
✅ Runs `npm install` (installs firebase-admin)
✅ Starts server with new features

### After Adding Environment Variable:
✅ Push notifications will work in production
✅ Firebase Admin SDK will initialize
✅ Users will receive notifications when results are published

---

## 🧪 Test Firebase on Railway:

After adding the environment variable and deployment completes, check the logs:

**Look for:**
```
✅ Firebase Admin initialized from env variable
✅ Push Notification Service initialized
```

**If you see:**
```
⚠️ Firebase not initialized
```
Then the environment variable wasn't set correctly.

---

## 🔧 How to Add Environment Variable (Detailed):

### Option A: Railway Dashboard (Recommended)

1. Login to Railway: https://railway.app
2. Select project: **myteer-backend**
3. Click **Variables** tab
4. Click **+ New Variable** or **Raw Editor**
5. Add this variable:
   ```
   FIREBASE_SERVICE_ACCOUNT=<paste entire firebase-service-account.json content here>
   ```
6. Save - Railway will redeploy automatically

### Option B: Railway CLI

```bash
railway login
railway link
railway variables set FIREBASE_SERVICE_ACCOUNT="$(cat firebase-service-account.json)"
```

---

## ✅ Verification Checklist:

After deployment completes:

- [ ] Railway deployment successful (check dashboard)
- [ ] Check Railway logs for "Firebase Admin initialized"
- [ ] Test leaderboard endpoint: `GET /api/leaderboard`
- [ ] Test analytics endpoint: `GET /api/admin/analytics` (with admin token)
- [ ] Send test notification from admin panel (when user registers FCM token)

---

## 🆘 Troubleshooting:

### Issue: "Firebase not initialized" in logs
**Solution:** Environment variable not set correctly. Verify in Railway dashboard.

### Issue: Notifications not sending
**Solution:**
1. Check Railway logs for Firebase errors
2. Verify FIREBASE_SERVICE_ACCOUNT contains valid JSON
3. Ensure no extra quotes or escaping in the JSON value

### Issue: Deployment failed
**Solution:**
1. Check Railway build logs for errors
2. Verify package.json has `firebase-admin` dependency
3. Check if there are any syntax errors in new code

---

## 📱 Testing Push Notifications:

### Step 1: Get FCM Token from App
1. Run the Flutter app on a device/emulator
2. Check console logs for: `📱 FCM Token: ...`
3. Token is automatically saved to backend

### Step 2: Publish Results (Triggers Auto-Notification)
1. Login to admin panel
2. Go to any house with active round
3. Publish FR and SR results
4. Backend automatically sends notification to all users who played in that round

### Step 3: Check Notification Received
- App should show notification (foreground, background, or terminated state)
- Notification will say: "Results are out for [House Name]"

---

## 🎯 New Features Live After Deployment:

1. **Push Notifications** - Auto-send when results published
2. **Leaderboard API** - Weekly top winners
3. **Admin Analytics** - Revenue, users, house performance
4. **FCM Token Management** - Auto-cleanup invalid tokens

---

## 📞 Support:

If you encounter issues:
1. Check Railway deployment logs
2. Check Railway environment variables
3. Verify firebase-service-account.json is valid JSON
4. Test locally first with `node test-firebase.js`

---

**Last Updated:** January 2025
**Backend Version:** v2.0 (with Firebase + Leaderboard + Analytics)
**Status:** ⚠️ Awaiting Firebase environment variable configuration
