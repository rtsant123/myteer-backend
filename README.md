# Myteer Backend API

Node.js + Express + MongoDB backend for Teer Betting Application.

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env and add your MongoDB URI

# Start server
npm start

# Development with auto-reload
npm run dev
```

Server runs at: `http://localhost:3000`

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Houses
- `GET /api/houses` - Get all active houses
- `GET /api/houses/:id` - Get house by ID
- `POST /api/houses` - Create house (Admin)
- `PUT /api/houses/:id` - Update house (Admin)

### Rounds
- `GET /api/rounds/active/:houseId` - Get active round
- `POST /api/rounds` - Create round (Admin)
- `PUT /api/rounds/:id/result` - Update results (Admin)

### Bets
- `POST /api/bets/place` - Place bet
- `GET /api/bets/user/:userId` - Get user bets

### Wallet
- `GET /api/wallet/balance` - Get balance
- `GET /api/wallet/transactions` - Get transactions

### Payments
- `GET /api/payment-methods` - Get payment methods
- `POST /api/deposits` - Submit deposit request
- `POST /api/withdrawals` - Submit withdrawal request
- `PUT /api/deposits/:id/approve` - Approve deposit (Admin)
- `PUT /api/withdrawals/:id/approve` - Approve withdrawal (Admin)

## 🔧 Environment Variables

```env
MONGO_URI=mongodb://localhost:27017/myteer
JWT_SECRET=your_secret_key
PORT=3000
NODE_ENV=production
```

## 🚢 Deployment to Railway

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial backend"
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. **Deploy on Railway**
   - Go to [railway.app](https://railway.app)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Add MongoDB database
   - Set environment variables:
     - `JWT_SECRET=your_secure_secret`
     - `NODE_ENV=production`
   - Deploy!

3. **Get Your URL**
   - Find it in Railway dashboard under "Settings" → "Domains"
   - Example: `https://myteer-backend-production.up.railway.app`

## 📝 License

MIT
