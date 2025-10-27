# 🚂 Railway Environment Variables Setup

## ⚠️ CRITICAL: You MUST set these before deploying!

After pushing the security fixes, your backend **will not start** without these environment variables properly set in Railway.

---

## 📋 Required Environment Variables

Go to Railway Dashboard → Your Project → Variables tab and add these:

### 1. JWT_SECRET (CRITICAL)
```
JWT_SECRET=b1cd3c13a5f8d86082187a5566540b678ff9abf9482faaa8c06793b57c3bc637d1dfb797ed2c15b28db9062fd426e7680d46d3ffe249b09540f62ff34704bb3d
```
**Important**: This is YOUR unique secret. Never share it publicly!

### 2. MONGO_URI (CRITICAL)
```
MONGO_URI=<your-mongodb-connection-string>
```
Example: `mongodb+srv://username:password@cluster.mongodb.net/myteer?retryWrites=true&w=majority`

### 3. NODE_ENV (RECOMMENDED)
```
NODE_ENV=production
```
This enables production-mode security features.

### 4. Twilio (Required for OTP)
```
TWILIO_ACCOUNT_SID=<your-twilio-account-sid>
TWILIO_AUTH_TOKEN=<your-twilio-auth-token>
TWILIO_PHONE_NUMBER=<your-twilio-phone-number>
```
Get these from https://console.twilio.com/

### 5. Firebase (Required for push notifications)
```
FIREBASE_SERVICE_ACCOUNT=<your-firebase-service-account-json>
```
This should be the ENTIRE contents of your firebase-service-account.json file as a single-line string.

---

## 🔧 How to Set Environment Variables in Railway

### Method 1: Railway Dashboard (Easiest)
1. Go to https://railway.app/
2. Click on your `myteer-backend-production` project
3. Click on the "Variables" tab
4. Click "+ New Variable"
5. Add each variable one by one:
   - Variable Name: `JWT_SECRET`
   - Value: `b1cd3c13a5f8d86082187a5566540b678ff9abf9482faaa8c06793b57c3bc637d1dfb797ed2c15b28db9062fd426e7680d46d3ffe249b09540f62ff34704bb3d`
6. Click "Add" and repeat for all variables above
7. Railway will automatically redeploy with new variables

### Method 2: Railway CLI
```bash
railway login
railway link
railway variables set JWT_SECRET="b1cd3c13a5f8d86082187a5566540b678ff9abf9482faaa8c06793b57c3bc637d1dfb797ed2c15b28db9062fd426e7680d46d3ffe249b09540f62ff34704bb3d"
railway variables set NODE_ENV="production"
# ... repeat for other variables
```

---

## ✅ Verify Variables Are Set

After setting variables, check the deployment logs in Railway:

**Good logs (should see)**:
```
✅ MongoDB Connected
🚀 Server running on port 3000
📡 Environment: production
🔒 Security: Helmet enabled, CORS restricted, Rate limiting active
```

**Bad logs (if you see these, variables are missing)**:
```
❌ FATAL: Missing required environment variables: JWT_SECRET
```

---

## 🚨 What Happens If Variables Are Missing?

With the new security fixes, the server will **REFUSE TO START** if critical variables are missing. This prevents running with insecure defaults.

You'll see errors like:
```
❌ FATAL ERROR: JWT_SECRET environment variable is not set!
   This is a critical security issue.
```

**Solution**: Set the missing variable in Railway and the service will auto-restart.

---

## 🔐 Security Notes

1. **Never commit secrets to Git** - They're in environment variables for a reason!
2. **JWT_SECRET**: The one above is unique for you. Don't share it!
3. **Rotate secrets** if they're ever exposed (generate new JWT_SECRET and update Railway)
4. **Monitor logs** in Railway to catch any issues early

---

## 📊 After Deployment Checklist

- [ ] All environment variables set in Railway
- [ ] Deployment successful (no error logs)
- [ ] Health check works: https://myteer-backend-production.up.railway.app/api/health
- [ ] Login works from Flutter app
- [ ] OTP works (if Twilio configured)
- [ ] Push notifications work (if Firebase configured)

---

## 🆘 Troubleshooting

### Server won't start
- **Check**: Are all REQUIRED variables set? (JWT_SECRET, MONGO_URI)
- **Check**: Railway deployment logs for error messages

### "Not allowed by CORS" errors
- This is NORMAL now! The API is secured.
- Mobile apps work fine (they have no origin header)
- If you add a web frontend, add its domain to `corsOptions` in `server.js`

### Rate limit errors
- Also NORMAL! Rate limiting is protecting your API
- Users get 100 requests per 15 mins (plenty for normal use)
- Only 5 login attempts per 15 mins (prevents brute force)
- Only 2 OTP requests per minute (saves Twilio costs!)

---

**Generated with [Claude Code](https://claude.com/claude-code)**
**Date**: 2025-10-27
