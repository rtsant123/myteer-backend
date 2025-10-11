# 🤖 Auto Round Creation Feature

## ✨ What Is It?

**Automatic Daily Round Creation** - Your backend will automatically create tomorrow's rounds every night at midnight, using the same timings as today's rounds.

---

## 🎯 How It Works

### Daily Schedule:

```
Every Day at 00:00 (Midnight):
├── Check all active houses
├── Find today's round for each house
├── Copy the timings (FR & SR open/close times)
├── Create tomorrow's round with same timings
└── Log results
```

### Example:

**Today's Round (Khanapara Teer):**
```
Date: October 11, 2025
FR Open:  10:00 AM
FR Close: 1:00 PM
SR Open:  1:30 PM
SR Close: 4:00 PM
```

**At Midnight:**
```
✅ System automatically creates:

Date: October 12, 2025
FR Open:  10:00 AM  ← Same time!
FR Close: 1:00 PM   ← Same time!
SR Open:  1:30 PM   ← Same time!
SR Close: 4:00 PM   ← Same time!
```

---

## 🚀 Benefits

✅ **No manual work** - Rounds create automatically
✅ **Consistent timing** - Same schedule every day
✅ **Never miss a day** - Runs even on holidays
✅ **Multi-house support** - Works for all your houses
✅ **Error handling** - Skips if tomorrow's round already exists
✅ **Logging** - See what was created in server logs

---

## 📋 How To Use

### 1. **Initial Setup (One Time)**

**Step 1:** Create your houses in admin panel
```
Example:
- Khanapara Teer
- Shillong Teer
- Bhutan Teer
```

**Step 2:** Create today's round for each house
```
Go to Admin Panel → Manage Rounds → Create Round

For Khanapara:
  Date: Today
  FR: 10:00 AM - 1:00 PM
  SR: 1:30 PM - 4:00 PM
```

**Step 3:** That's it! The system takes over.

### 2. **Automatic Daily Creation**

**What happens at midnight:**
```
12:00 AM:
  ✅ Backend wakes up
  ✅ Finds Khanapara's round from today
  ✅ Creates tomorrow's Khanapara round (same times)
  ✅ Finds Shillong's round from today
  ✅ Creates tomorrow's Shillong round (same times)
  ✅ Repeats for all houses
  ✅ Goes back to sleep
```

### 3. **Manual Trigger (Optional)**

If you want to create tomorrow's rounds NOW instead of waiting for midnight:

**API Endpoint:**
```bash
POST /api/rounds/auto-create
Authorization: Bearer YOUR_ADMIN_TOKEN
```

**In Postman / API Testing:**
```
Method: POST
URL: https://myteer-backend-production.up.railway.app/api/rounds/auto-create
Headers:
  Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "message": "Tomorrow's rounds created successfully"
}
```

---

## 🔧 Advanced Features

### Changing Round Timings

**Scenario:** You want to change FR time from 1:00 PM to 2:00 PM starting tomorrow.

**Method 1: Change Today's Round**
```
1. Update today's round FR close time to 2:00 PM
2. Wait for midnight
3. Tomorrow's round will auto-create with 2:00 PM
4. All future rounds will use 2:00 PM
```

**Method 2: Delete and Recreate**
```
1. Delete today's round (if no bets placed)
2. Create new round with correct times
3. System will copy the new times going forward
```

### Skipping Auto-Creation

**Scenario:** You don't want a round tomorrow (holiday).

**Solution 1: Let it create, then delete**
```
1. Let system create tomorrow's round at midnight
2. Morning: Login as admin → Delete tomorrow's round
```

**Solution 2: Create manually before midnight**
```
1. Before midnight, manually create tomorrow's round with status "closed"
2. Auto-creator will skip (round already exists)
```

### Different Timings for Different Days

**Scenario:** Weekdays use 1:00 PM, weekends use 2:00 PM.

**Current limitation:** System uses same timing every day.

**Workaround:**
```
Friday evening:
  1. Manually update Saturday's auto-created round to 2:00 PM
  2. Manually update Sunday's round to 2:00 PM

Monday morning:
  Back to automatic with weekday timings
```

**Future enhancement:** We can add day-of-week specific timings!

---

## 📊 Monitoring

### Check Server Logs

In Railway dashboard:
```
1. Click on your service
2. Click "Deployments" tab
3. Click "View Logs"
4. Look for midnight activity:
```

**Success logs:**
```
⏰ Auto-round creation scheduler initialized (runs daily at midnight)
✅ MongoDB Connected

[12:00 AM]
🔄 Starting auto-round creation for tomorrow...
📅 Creating rounds for: Sat Oct 12 2025
🏠 Found 3 active houses
✅ Created round for Khanapara Teer
   FR: 10:00 AM - 01:00 PM
   SR: 01:30 PM - 04:00 PM
✅ Created round for Shillong Teer
   FR: 11:00 AM - 02:00 PM
   SR: 02:30 PM - 05:00 PM
✅ Created round for Bhutan Teer
   FR: 09:00 AM - 12:00 PM
   SR: 12:30 PM - 03:00 PM
✅ Auto-round creation completed successfully
```

**Skip logs (already exists):**
```
⏭️  Round already exists for Khanapara Teer on Sat Oct 12 2025
```

**Error logs:**
```
⚠️  No template round found for Ladrymbai Teer, skipping...
❌ Failed to create round for Bhutan Teer: [error details]
```

---

## ⚠️ Important Notes

### 1. **First Day Setup Required**

Auto-creation only works if you have **at least one round created manually** for each house.

**Why?** The system needs a "template" to copy timings from.

**Solution:** On day 1, manually create rounds for all your houses.

### 2. **Timezone Handling**

Midnight is based on **your server's timezone** (Railway uses UTC by default).

**If midnight UTC doesn't match your timezone:**
- Modify the cron schedule in `utils/roundScheduler.js`
- Change `'0 0 * * *'` to your preferred time

**Example for 12 AM IST (6:30 PM UTC):**
```javascript
cron.schedule('30 18 * * *', async () => {
  // Runs at 6:30 PM UTC = 12:00 AM IST
});
```

### 3. **Stopped Rounds**

If a house doesn't have today's round, tomorrow won't be created for that house.

**Solution:** Always maintain at least today's round for active houses.

### 4. **Editing Future Rounds**

You can manually edit auto-created rounds before they start:
```
1. Go to Admin Panel → Manage Rounds
2. Find tomorrow's round
3. Edit FR/SR times if needed
4. Save
```

---

## 🔍 Troubleshooting

### Issue: Rounds not auto-creating

**Check 1:** Is backend running?
```bash
curl https://myteer-backend-production.up.railway.app/api/health
```

**Check 2:** Are there today's rounds?
```
Login → Admin Panel → Manage Rounds → Check today's date
```

**Check 3:** Check server logs at midnight
```
Railway Dashboard → Deployments → View Logs
Look for: "Starting auto-round creation"
```

**Check 4:** Manually trigger
```bash
POST /api/rounds/auto-create
```

### Issue: Wrong timings created

**Cause:** Today's round has wrong timings

**Solution:**
1. Fix today's round timings
2. Delete tomorrow's round
3. Wait for next midnight OR manually trigger

### Issue: Multiple rounds for same day

**Cause:** Manual creation + Auto creation both ran

**Solution:**
1. Delete duplicate rounds
2. Ensure you don't manually create while auto-creator runs

### Issue: Missing rounds for some houses

**Check:** Do those houses have today's round?

**Solution:** Create today's round manually, system will copy tomorrow.

---

## 📈 Future Enhancements

These can be added in the future:

✅ **Day-specific timings** - Different times for weekends
✅ **Holiday calendar** - Skip specific dates
✅ **Bulk creation** - Create next 7 days at once
✅ **Email notifications** - Alert admin when rounds created
✅ **Custom intervals** - Create weekly instead of daily
✅ **Template library** - Save and reuse timing templates

**Want any of these?** Let me know!

---

## 🎯 Quick Reference

### Initial Setup:
```
1. Create houses in admin panel
2. Create today's round for each house
3. Done! System takes over
```

### Daily Operation:
```
Midnight: Rounds auto-create
Morning: Admin updates results for yesterday
         Users bet on today's rounds
Evening: Admin updates today's results
Night:   System prepares tomorrow's rounds
```

### Manual Control:
```
API: POST /api/rounds/auto-create
Purpose: Create tomorrow's rounds NOW
Access: Admin only
```

### Monitoring:
```
Location: Railway Dashboard → Deployments → View Logs
Time: Check logs at 12:00 AM
Look for: "Auto-round creation completed successfully"
```

---

## ✅ Current Status

**Feature:** ✅ Deployed to Railway
**Scheduler:** ✅ Running (starts when backend starts)
**Schedule:** ✅ Daily at midnight (00:00 UTC)
**Houses:** ✅ Supports all active houses
**Manual Trigger:** ✅ Available via API
**Logging:** ✅ Full logging enabled

---

## 🎊 You're All Set!

Your backend will now **automatically create tomorrow's rounds every night** without any manual intervention!

**What you need to do:**
1. ✅ Create today's rounds (one time)
2. ✅ Update results daily
3. ✅ That's it!

**What the system does:**
1. ✅ Creates tomorrow's rounds at midnight
2. ✅ Uses same timings as today
3. ✅ Handles all houses automatically
4. ✅ Logs everything for monitoring

**Your backend is now fully automated! 🚀**

---

**Questions?** Check the server logs or try the manual trigger endpoint!
