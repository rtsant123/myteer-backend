# 🚀 Railway Deployment Guide

## Step-by-Step Deployment to Railway

### **Step 1: Push Backend to GitHub**

```bash
# Create a new repository on GitHub first (go to github.com/new)
# Then run these commands:

cd C:\Users\MSP001\AndroidStudioProjects\myteer_backend

# Add your GitHub repository as remote (replace with your repo URL)
git remote add origin https://github.com/YOUR_USERNAME/myteer-backend.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### **Step 2: Deploy to Railway**

1. **Go to Railway**
   - Visit: https://railway.app
   - Click "Login" → Sign in with GitHub
   - Authorize Railway to access your GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose `myteer-backend` repository
   - Railway will automatically detect it's a Node.js app

3. **Add MongoDB Database**
   - In your Railway project, click "New" button
   - Select "Database" → "Add MongoDB"
   - Railway will automatically provision MongoDB
   - The MONGO_URI will be automatically added to environment variables

4. **Set Environment Variables**
   - Click on your service (myteer-backend)
   - Go to "Variables" tab
   - Add these variables:
     ```
     JWT_SECRET=myteer_super_secret_jwt_key_2024
     NODE_ENV=production
     PORT=3000
     ```
   - Note: MONGO_URI is automatically set by Railway's MongoDB

5. **Wait for Deployment**
   - Railway will automatically build and deploy
   - Watch the logs in the "Deployments" tab
   - Look for: "✅ MongoDB Connected" and "🚀 Server running on port 3000"

6. **Get Your Backend URL**
   - Click on your service
   - Go to "Settings" tab
   - Click "Generate Domain" under "Public Networking"
   - Copy the URL (e.g., `https://myteer-backend-production.up.railway.app`)

### **Step 3: Test Your Backend**

```bash
# Test health endpoint
curl https://YOUR-RAILWAY-URL.up.railway.app/api/health

# Should return:
# {"status":"ok","message":"Myteer API is running"}
```

### **Step 4: Update Flutter App**

1. Open `C:\Users\MSP001\AndroidStudioProjects\myteer_flutter\lib\config\api_config.dart`

2. Update these lines:
   ```dart
   static const String baseUrl = 'https://YOUR-RAILWAY-URL.up.railway.app/api';
   static const bool isDemoMode = false; // Switch to real backend
   ```

3. Save the file

### **Step 5: Build Production APK**

```bash
cd C:\Users\MSP001\AndroidStudioProjects\myteer_flutter

# Build release APK
flutter build apk --release

# APK will be at:
# build\app\outputs\flutter-apk\app-release.apk
```

### **Step 6: Test Everything**

1. **Install APK on Android device**
2. **Create account** (register)
3. **Test betting flow**
4. **Test wallet operations**

---

## 🎯 Quick Checklist

- [ ] Backend pushed to GitHub
- [ ] Railway project created
- [ ] MongoDB database added
- [ ] Environment variables set (JWT_SECRET, NODE_ENV)
- [ ] Deployment successful (check logs)
- [ ] Backend URL obtained
- [ ] Flutter app updated with backend URL
- [ ] isDemoMode set to false
- [ ] APK built
- [ ] APK tested on device

---

## 🔧 Troubleshooting

### Backend won't deploy
- Check Railway logs for errors
- Ensure package.json has `"start": "node server.js"`
- Verify all dependencies are in package.json

### MongoDB connection failed
- Ensure MongoDB plugin is added in Railway
- Check MONGO_URI is automatically set
- Look for connection errors in Railway logs

### Flutter app can't connect
- Verify backend URL is correct (with `/api` at the end)
- Check isDemoMode is set to false
- Test backend health endpoint first
- Ensure your phone has internet connection

### No demo users in production
You need to create users via registration or add demo users in MongoDB:

```javascript
// Run this in Railway MongoDB console
db.users.insertOne({
  phone: "1234567890",
  password: "$2a$10$hashed_password_here",
  name: "Demo User",
  balance: 1000,
  isAdmin: false,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
})
```

---

## 📞 Support

Need help? Check:
- Railway Docs: https://docs.railway.app
- Backend README: `README.md`
- Flutter App Docs: `../myteer_flutter/README.md`

---

**You're ready to go live! 🎉**
