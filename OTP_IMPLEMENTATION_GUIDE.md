# OTP Implementation Guide

## Option 1: Use Your Existing FastAPI Backend (Recommended)

Your FastAPI backend at `github.com/rtsant123/teer-betting-app` already has OTP endpoints. You just need to add SMS provider.

### Step 1: Choose SMS Provider

#### A) MSG91 (Recommended for India)

**Signup:**
- Go to https://msg91.com/
- Sign up for account
- Get AUTH_KEY and TEMPLATE_ID

**Install library:**
```bash
pip install requests
```

**Update your FastAPI backend** (`app/services/otp_service.py`):
```python
import requests
import random
import os

def generate_otp():
    return str(random.randint(100000, 999999))

async def send_sms_otp(phone: str, otp: str):
    """Send OTP via MSG91"""
    url = "https://api.msg91.com/api/v5/otp"

    payload = {
        "template_id": os.getenv("MSG91_TEMPLATE_ID"),
        "mobile": phone,
        "authkey": os.getenv("MSG91_AUTH_KEY"),
        "otp": otp
    }

    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            return True
        else:
            print(f"MSG91 Error: {response.text}")
            return False
    except Exception as e:
        print(f"SMS Error: {e}")
        return False
```

**Environment variables:**
```env
MSG91_AUTH_KEY=your_auth_key_here
MSG91_TEMPLATE_ID=your_template_id
```

---

#### B) Fast2SMS (Alternative for India)

**Signup:**
- Go to https://www.fast2sms.com/
- Sign up and verify
- Get API key from dashboard

**Update your FastAPI backend:**
```python
import requests
import random
import os

def generate_otp():
    return str(random.randint(100000, 999999))

async def send_sms_otp(phone: str, otp: str):
    """Send OTP via Fast2SMS"""
    url = "https://www.fast2sms.com/dev/bulkV2"

    payload = {
        "route": "v3",
        "sender_id": "MYTEER",
        "message": f"Your Myteer verification code is: {otp}. Valid for 10 minutes.",
        "language": "english",
        "flash": 0,
        "numbers": phone
    }

    headers = {
        "authorization": os.getenv("FAST2SMS_API_KEY"),
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        if response.status_code == 200:
            return True
        else:
            print(f"Fast2SMS Error: {response.text}")
            return False
    except Exception as e:
        print(f"SMS Error: {e}")
        return False
```

**Environment variables:**
```env
FAST2SMS_API_KEY=your_api_key_here
```

---

#### C) Twilio (International, More Expensive)

**Signup:**
- Go to https://www.twilio.com/
- Sign up ($15 credit for new users)
- Get Account SID, Auth Token, Phone Number

**Install library:**
```bash
pip install twilio
```

**Update your FastAPI backend:**
```python
from twilio.rest import Client
import random
import os

def generate_otp():
    return str(random.randint(100000, 999999))

async def send_sms_otp(phone: str, otp: str):
    """Send OTP via Twilio"""
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_PHONE_NUMBER")

    try:
        client = Client(account_sid, auth_token)
        message = client.messages.create(
            body=f"Your Myteer verification code is: {otp}. Valid for 10 minutes.",
            from_=from_number,
            to=phone
        )
        return True
    except Exception as e:
        print(f"Twilio Error: {e}")
        return False
```

**Environment variables:**
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

---

### Step 2: Connect Flutter App to FastAPI OTP

**Update `lib/config/api_config.dart`:**
```dart
class ApiConfig {
  // Main backend (Node.js)
  static const String baseUrl = 'https://myteer-backend-production.up.railway.app/api';

  // OTP backend (FastAPI)
  static const String otpBaseUrl = 'https://your-fastapi-backend.com/api';

  static const bool isDemoMode = false;
}
```

**Update `lib/services/api_service.dart`** to add OTP methods:
```dart
// Add to ApiService class:

Future<bool> sendOTP(String phone) async {
  try {
    final response = await http.post(
      Uri.parse('${ApiConfig.otpBaseUrl}/otp/generate'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'phone': phone}),
    );

    if (response.statusCode == 200) {
      return true;
    } else {
      throw Exception('Failed to send OTP');
    }
  } catch (e) {
    print('Send OTP error: $e');
    return false;
  }
}

Future<bool> verifyOTP(String phone, String otp) async {
  try {
    final response = await http.post(
      Uri.parse('${ApiConfig.otpBaseUrl}/otp/verify'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'phone': phone,
        'otp': otp,
      }),
    );

    if (response.statusCode == 200) {
      return true;
    } else {
      return false;
    }
  } catch (e) {
    print('Verify OTP error: $e');
    return false;
  }
}
```

**Update `lib/providers/auth_provider.dart`:**
```dart
Future<bool> sendOTP(String phone) async {
  try {
    setLoading(true);
    final success = await _apiService.sendOTP(phone);
    return success;
  } catch (e) {
    _error = e.toString();
    return false;
  } finally {
    setLoading(false);
  }
}

Future<bool> verifyOTP(String phone, String otp) async {
  try {
    setLoading(true);
    final success = await _apiService.verifyOTP(phone, otp);
    return success;
  } catch (e) {
    _error = e.toString();
    return false;
  } finally {
    setLoading(false);
  }
}

Future<bool> register(RegisterRequest request) async {
  try {
    setLoading(true);

    // 1. Send OTP first
    final otpSent = await sendOTP(request.phone);
    if (!otpSent) {
      throw Exception('Failed to send OTP');
    }

    // 2. User enters OTP in UI (handled by register_screen.dart)
    // 3. After OTP verified, create account
    final response = await _apiService.register(request);
    _token = response.accessToken;
    _user = response.user;

    await _storageService.saveToken(_token);

    notifyListeners();
    return true;
  } catch (e) {
    _error = e.toString();
    return false;
  } finally {
    setLoading(false);
  }
}
```

**Update `lib/screens/auth/register_screen.dart`:**
```dart
// Add OTP input field and verification flow:

bool _otpSent = false;
bool _otpVerified = false;
final _otpController = TextEditingController();

void _sendOTP() async {
  if (!_formKey.currentState!.validate()) return;

  final phone = _phoneController.text;

  final success = await authProvider.sendOTP(phone);

  if (success && mounted) {
    setState(() {
      _otpSent = true;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('OTP sent to $phone')),
    );
  } else {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Failed to send OTP')),
    );
  }
}

void _verifyOTP() async {
  final phone = _phoneController.text;
  final otp = _otpController.text;

  if (otp.length != 6) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Please enter 6-digit OTP')),
    );
    return;
  }

  final success = await authProvider.verifyOTP(phone, otp);

  if (success && mounted) {
    setState(() {
      _otpVerified = true;
    });

    // Now register the user
    _register();
  } else {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Invalid OTP')),
    );
  }
}

void _register() async {
  // Only called after OTP is verified
  final success = await authProvider.register(RegisterRequest(
    phone: _phoneController.text,
    password: _passwordController.text,
    name: _nameController.text,
  ));

  if (success && mounted) {
    Navigator.of(context).pushReplacementNamed('/home');
  }
}
```

---

## Option 2: Add OTP to Current Node.js Backend

If you want OTP in your current Node.js backend instead:

### Step 1: Install SMS Library

```bash
cd C:\Users\MSP001\AndroidStudioProjects\myteer_backend
npm install axios
```

### Step 2: Create OTP Service

**Create `utils/otpService.js`:**
```javascript
const axios = require('axios');

// In-memory OTP storage (use Redis in production)
const otpStore = new Map();

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP via MSG91
async function sendOTP(phone) {
  const otp = generateOTP();

  // Store OTP with 10-minute expiry
  otpStore.set(phone, {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
  });

  try {
    // Send via MSG91
    const response = await axios.post('https://api.msg91.com/api/v5/otp', {
      template_id: process.env.MSG91_TEMPLATE_ID,
      mobile: phone,
      authkey: process.env.MSG91_AUTH_KEY,
      otp: otp
    });

    if (response.data.type === 'success') {
      return { success: true, message: 'OTP sent successfully' };
    } else {
      throw new Error('Failed to send OTP');
    }
  } catch (error) {
    console.error('OTP Send Error:', error);
    return { success: false, message: 'Failed to send OTP' };
  }
}

// Verify OTP
function verifyOTP(phone, otp) {
  const stored = otpStore.get(phone);

  if (!stored) {
    return { success: false, message: 'OTP not found or expired' };
  }

  if (Date.now() > stored.expiresAt) {
    otpStore.delete(phone);
    return { success: false, message: 'OTP expired' };
  }

  if (stored.otp !== otp) {
    return { success: false, message: 'Invalid OTP' };
  }

  // OTP verified, remove from store
  otpStore.delete(phone);
  return { success: true, message: 'OTP verified' };
}

module.exports = {
  sendOTP,
  verifyOTP
};
```

### Step 3: Create OTP Routes

**Create `routes/otp.js`:**
```javascript
const express = require('express');
const router = express.Router();
const { sendOTP, verifyOTP } = require('../utils/otpService');

// @route   POST /api/otp/send
// @desc    Send OTP to phone
// @access  Public
router.post('/send', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    const result = await sendOTP(phone);

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/otp/verify
// @desc    Verify OTP
// @access  Public
router.post('/verify', async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone and OTP are required'
      });
    }

    const result = verifyOTP(phone, otp);

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
```

### Step 4: Add OTP Routes to Server

**Update `server.js`:**
```javascript
// Add after other routes:
app.use('/api/otp', require('./routes/otp'));
```

### Step 5: Update Registration Flow

**Update `routes/auth.js`** to require OTP verification:
```javascript
// Add at the top:
const { verifyOTP } = require('../utils/otpService');

// Update register route:
router.post('/register', async (req, res) => {
  try {
    const { phone, password, name, otp } = req.body;

    // Verify OTP first
    const otpResult = verifyOTP(phone, otp);
    if (!otpResult.success) {
      return res.status(400).json({
        success: false,
        message: otpResult.message
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already registered'
      });
    }

    // Create user (rest of the code remains same)
    const user = await User.create({
      phone,
      password,
      name: name || '',
      balance: 0
    });

    // Generate token
    const accessToken = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      accessToken,
      user: {
        _id: user._id,
        phone: user.phone,
        name: user.name,
        balance: user.balance
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
```

### Step 6: Add Environment Variables

**Update `.env`:**
```env
MSG91_AUTH_KEY=your_auth_key_here
MSG91_TEMPLATE_ID=your_template_id
```

### Step 7: Update Flutter App

**Update `lib/services/api_service.dart`:**
```dart
Future<bool> sendOTP(String phone) async {
  try {
    final response = await http.post(
      Uri.parse('$baseUrl/otp/send'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'phone': phone}),
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return data['success'] == true;
    }
    return false;
  } catch (e) {
    print('Send OTP error: $e');
    return false;
  }
}

Future<bool> verifyOTP(String phone, String otp) async {
  try {
    final response = await http.post(
      Uri.parse('$baseUrl/otp/verify'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'phone': phone,
        'otp': otp,
      }),
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return data['success'] == true;
    }
    return false;
  } catch (e) {
    print('Verify OTP error: $e');
    return false;
  }
}

Future<AuthResponse> register(RegisterRequest request, String otp) async {
  try {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/register'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'phone': request.phone,
        'password': request.password,
        'name': request.name,
        'otp': otp, // Include OTP
      }),
    );

    if (response.statusCode == 201) {
      final data = json.decode(response.body);
      return AuthResponse.fromJson(data);
    } else {
      throw Exception(json.decode(response.body)['message']);
    }
  } catch (e) {
    throw Exception('Registration failed: $e');
  }
}
```

**Update `lib/screens/auth/register_screen.dart`** (same as Option 1 above).

---

## Recommendation

**Use Option 2** (Add OTP to Node.js backend) because:
- ✅ Single backend to maintain
- ✅ All features in one place
- ✅ Simpler deployment
- ✅ Less complexity

**SMS Provider Recommendation:**
- **MSG91** - Best for India, affordable, reliable
- **Fast2SMS** - Also good for India, cheaper
- **Twilio** - Best for international, more expensive

---

## Cost Estimates

### MSG91:
- ₹0.15 per SMS (transactional)
- 1000 SMS = ₹150

### Fast2SMS:
- ₹0.10 per SMS
- 1000 SMS = ₹100

### Twilio:
- $0.0079 per SMS (India)
- 1000 SMS = ₹660

---

## Testing OTP Without SMS (Development)

For testing, add a bypass in development:

**Update `utils/otpService.js`:**
```javascript
function verifyOTP(phone, otp) {
  // Development bypass - any OTP works for test number
  if (process.env.NODE_ENV === 'development' && phone === '9999999999') {
    return { success: true, message: 'OTP verified (dev mode)' };
  }

  // Production verification
  const stored = otpStore.get(phone);
  // ... rest of the code
}
```

This allows testing without SMS costs during development.

---

## After Implementation

1. **Deploy Backend Changes:**
```bash
cd C:\Users\MSP001\AndroidStudioProjects\myteer_backend
git add .
git commit -m "Add OTP verification"
git push origin main
```

2. **Railway Auto-Deploys:** Your backend will update automatically

3. **Add Environment Variables in Railway:**
- Go to Railway dashboard
- Select myteer-backend-production
- Add variables: `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`

4. **Rebuild Flutter APK:**
```bash
cd C:\Users\MSP001\AndroidStudioProjects\myteer_flutter
flutter build apk --release
```

5. **Test Registration:**
- Install new APK
- Try registering with real phone number
- Should receive OTP SMS
- Enter OTP to complete registration

---

## Summary

Choose your path:
1. **Option 1:** Use FastAPI backend for OTP (if you want to use existing code)
2. **Option 2:** Add OTP to Node.js backend (recommended for simplicity)

Both options work with MSG91/Fast2SMS/Twilio for sending actual SMS.

For testing without SMS costs, use the development bypass code.
